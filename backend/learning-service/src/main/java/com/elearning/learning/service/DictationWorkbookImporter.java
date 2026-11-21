package com.elearning.learning.service;

import com.elearning.learning.common.exception.DictationValidationException;
import com.elearning.learning.dto.DictationModels.Definition;
import com.elearning.learning.dto.DictationModels.SaveRequest;
import jakarta.validation.Validator;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

@Service
public class DictationWorkbookImporter {

    static final String LOCAL_INBOX_STORAGE = "local-inbox";
    static final String S3_STORAGE = "s3";

    private static final Logger log = LoggerFactory.getLogger(DictationWorkbookImporter.class);

    private final DictationWorkbookService workbooks;
    private final DictationService dictation;
    private final Validator validator;
    private final JdbcTemplate jdbc;
    private final JsonMapper json;
    private final TransactionTemplate transaction;
    private final DictationWorkbookSync sync;
    private final Path directory;
    private final Map<Path, FileStamp> inspected = new HashMap<>();

    public DictationWorkbookImporter(
        DictationWorkbookService workbooks,
        DictationService dictation,
        Validator validator,
        JdbcTemplate jdbc,
        JsonMapper json,
        PlatformTransactionManager transactions,
        @Value("${dictation.import-dir:}") String directory
    ) {
        this(workbooks, dictation, validator, jdbc, json, transactions, (DictationWorkbookSync) null, directory);
    }

    @Autowired
    public DictationWorkbookImporter(
        DictationWorkbookService workbooks,
        DictationService dictation,
        Validator validator,
        JdbcTemplate jdbc,
        JsonMapper json,
        PlatformTransactionManager transactions,
        ObjectProvider<DictationWorkbookSync> sync,
        @Value("${dictation.import-dir:}") String directory
    ) {
        this(workbooks, dictation, validator, jdbc, json, transactions, sync.getIfAvailable(), directory);
    }

    private DictationWorkbookImporter(
        DictationWorkbookService workbooks,
        DictationService dictation,
        Validator validator,
        JdbcTemplate jdbc,
        JsonMapper json,
        PlatformTransactionManager transactions,
        DictationWorkbookSync sync,
        String directory
    ) {
        this.workbooks = workbooks;
        this.dictation = dictation;
        this.validator = validator;
        this.jdbc = jdbc;
        this.json = json;
        this.transaction = new TransactionTemplate(transactions);
        this.sync = sync;
        this.directory = directory.isBlank() ? null : Path.of(directory);
    }

    private record FileStamp(long size, FileTime lastModified, Object key) {}

    private record SourceRecord(String exerciseId, String contentSha256) {}

    @Scheduled(fixedDelay = 15_000)
    public void scan() {
        if (directory == null) return;
        List<Path> files;
        try (var entries = Files.list(directory)) {
            files = entries.filter(path -> isWorkbookName(path.getFileName().toString())).toList();
        } catch (IOException | UncheckedIOException ex) {
            log.warn("Cannot scan dictation workbook directory errorType={}", ex.getClass().getSimpleName());
            return;
        }
        inspected.keySet().retainAll(new HashSet<>(files));
        for (Path file : files) inspect(file);
    }

    private void inspect(Path file) {
        String filename = file.getFileName().toString();
        try {
            FileStamp stamp = stamp(file);
            if (stamp == null || stamp.equals(inspected.get(file))) return;
            try {
                if (stamp.size() > DictationWorkbookService.MAX_WORKBOOK_BYTES) {
                    throw new DictationValidationException("Tệp Excel vượt quá 5 MB.");
                }
                byte[] contents;
                try (var input = Files.newInputStream(file, LinkOption.NOFOLLOW_LINKS)) {
                    contents = input.readNBytes(DictationWorkbookService.MAX_WORKBOOK_BYTES + 1);
                }
                // A file that changed while being read will be checked on the next scan.
                if (!stamp.equals(stamp(file))) return;
                importWorkbook(LOCAL_INBOX_STORAGE, filename, contents);
            } catch (DictationValidationException invalid) {
                log.warn("Rejected dictation workbook file={} reason={}", filename, invalid.getMessage());
            }
            inspected.put(file, stamp);
        } catch (IOException | RuntimeException ex) {
            log.warn("Cannot import dictation workbook file={} errorType={}", filename, ex.getClass().getSimpleName());
        }
    }

    static boolean isWorkbookName(String name) {
        return !name.startsWith("~$") && name.toLowerCase(Locale.ROOT).endsWith(".xlsx");
    }

    void importWorkbook(String storageType, String objectKey, byte[] contents) {
        Definition definition = workbooks.parseLesson(contents);
        var violations = validator.validate(definition);
        if (!violations.isEmpty()) {
            throw new DictationValidationException(
                "Thông tin bài nghe không hợp lệ ở trường " + violations.iterator().next().getPropertyPath()
            );
        }
        String digest = fingerprint(json, definition);
        String updatedOrPublished = applyImport(storageType, objectKey, definition, digest);
        if (updatedOrPublished != null) {
            if (sync != null && !storageType.equals(sync.storageType())) {
                sync.syncNow(updatedOrPublished);
            }
            log.info("Synchronized dictation workbook storage={} key={} exerciseId={}", storageType, objectKey, updatedOrPublished);
        }
    }

    private FileStamp stamp(Path file) throws IOException {
        var attributes = Files.readAttributes(file, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
        return attributes.isRegularFile()
            ? new FileStamp(attributes.size(), attributes.lastModifiedTime(), attributes.fileKey())
            : null;
    }

    static String fingerprint(JsonMapper json, Definition definition) {
        try {
            var sha256 = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha256.digest(json.writeValueAsBytes(definition)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private String applyImport(String storageType, String objectKey, Definition definition, String digest) {
        try {
            return transaction.execute(status -> {
                SourceRecord existing = findSource(storageType, objectKey);
                if (existing != null) {
                    if (digest.equals(existing.contentSha256()) || isSyncPending(existing.exerciseId())) {
                        return null;
                    }
                    var detail = dictation.adminDetail(existing.exerciseId());
                    var updated = dictation.saveAndPublish(
                        existing.exerciseId(),
                        new SaveRequest(definition, detail.version())
                    );
                    if (detail.archived()) {
                        dictation.visibility(existing.exerciseId(), true);
                    }
                    jdbc.update(
                        "UPDATE dictation_workbook_sources SET content_sha256=? WHERE exercise_id=? AND storage=?",
                        digest, existing.exerciseId(), storageType
                    );
                    recordImportDigest(jdbc, digest, existing.exerciseId());
                    if (!detail.archived() && sync != null && !storageType.equals(sync.storageType())) {
                        sync.request(existing.exerciseId(), updated.version());
                    }
                    return existing.exerciseId();
                }

                String existingByDigest = findExerciseByDigest(digest);
                if (existingByDigest != null) {
                    attachSourceIfAbsent(existingByDigest, storageType, objectKey, digest);
                    return null;
                }

                var lesson = dictation.saveAndPublish(null, new SaveRequest(definition, 0));
                // The receipt, source binding and lesson share a transaction so concurrent scans cannot leave duplicates.
                jdbc.update(
                    "INSERT INTO dictation_workbook_imports (content_sha256, exercise_id) VALUES (?, ?)",
                    digest, lesson.id()
                );
                jdbc.update(
                    "INSERT INTO dictation_workbook_sources (exercise_id, storage, object_key, content_sha256) VALUES (?, ?, ?, ?)",
                    lesson.id(), storageType, objectKey, digest
                );
                return lesson.id();
            });
        } catch (DuplicateKeyException ex) {
            if (findSource(storageType, objectKey) != null || findExerciseByDigest(digest) != null) return null;
            throw ex;
        }
    }

    private SourceRecord findSource(String storageType, String objectKey) {
        return jdbc.query(
            "SELECT exercise_id, content_sha256 FROM dictation_workbook_sources WHERE storage=? AND object_key=?",
            (rs, row) -> new SourceRecord(rs.getString("exercise_id"), rs.getString("content_sha256")),
            storageType, objectKey
        ).stream().findFirst().orElse(null);
    }

    private boolean isSyncPending(String exerciseId) {
        return !jdbc.queryForList(
            "SELECT exercise_id FROM dictation_workbook_sync WHERE exercise_id=? AND pending=TRUE",
            String.class, exerciseId
        ).isEmpty();
    }

    private void attachSourceIfAbsent(String exerciseId, String storageType, String objectKey, String digest) {
        boolean hasSource = !jdbc.queryForList(
            "SELECT object_key FROM dictation_workbook_sources WHERE exercise_id=? AND storage=?",
            String.class, exerciseId, storageType
        ).isEmpty();
        if (!hasSource) {
            jdbc.update(
                "INSERT INTO dictation_workbook_sources (exercise_id, storage, object_key, content_sha256) VALUES (?, ?, ?, ?)",
                exerciseId, storageType, objectKey, digest
            );
        }
    }

    private String findExerciseByDigest(String digest) {
        return jdbc.queryForList(
            "SELECT exercise_id FROM dictation_workbook_imports WHERE content_sha256=?",
            String.class, digest
        ).stream().findFirst().orElse(null);
    }

    static void recordImportDigest(JdbcTemplate jdbc, String digest, String exerciseId) {
        int updated = jdbc.update(
            "UPDATE dictation_workbook_imports SET exercise_id=? WHERE content_sha256=?",
            exerciseId, digest
        );
        if (updated == 0) {
            jdbc.update(
                "INSERT INTO dictation_workbook_imports (content_sha256, exercise_id) VALUES (?, ?)",
                digest, exerciseId
            );
        }
    }
}
