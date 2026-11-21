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

    private static final Logger log = LoggerFactory.getLogger(DictationWorkbookImporter.class);

    private final DictationWorkbookService workbooks;
    private final DictationService dictation;
    private final Validator validator;
    private final JdbcTemplate jdbc;
    private final JsonMapper json;
    private final TransactionTemplate transaction;
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
        this.workbooks = workbooks;
        this.dictation = dictation;
        this.validator = validator;
        this.jdbc = jdbc;
        this.json = json;
        this.transaction = new TransactionTemplate(transactions);
        this.directory = directory.isBlank() ? null : Path.of(directory);
    }

    private record FileStamp(long size, FileTime lastModified, Object key) {}

    @Scheduled(fixedDelay = 15_000)
    public void scan() {
        if (directory == null) return;
        List<Path> files;
        try (var entries = Files.list(directory)) {
            files = entries.filter(path -> {
                String name = path.getFileName().toString();
                return !name.startsWith("~$") && name.toLowerCase(Locale.ROOT).endsWith(".xlsx");
            }).toList();
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
                Definition definition = workbooks.parseLesson(contents);
                var violations = validator.validate(definition);
                if (!violations.isEmpty()) {
                    throw new DictationValidationException(
                        "Thông tin bài nghe không hợp lệ ở trường " + violations.iterator().next().getPropertyPath()
                    );
                }
                String digest = fingerprint(definition);
                String exerciseId = publish(definition, digest);
                if (exerciseId != null) {
                    log.info("Published dictation workbook file={} exerciseId={}", filename, exerciseId);
                }
            } catch (DictationValidationException invalid) {
                log.warn("Rejected dictation workbook file={} reason={}", filename, invalid.getMessage());
            }
            inspected.put(file, stamp);
        } catch (IOException | RuntimeException ex) {
            log.warn("Cannot import dictation workbook file={} errorType={}", filename, ex.getClass().getSimpleName());
        }
    }

    private FileStamp stamp(Path file) throws IOException {
        var attributes = Files.readAttributes(file, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
        return attributes.isRegularFile()
            ? new FileStamp(attributes.size(), attributes.lastModifiedTime(), attributes.fileKey())
            : null;
    }

    private String fingerprint(Definition definition) {
        try {
            var sha256 = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha256.digest(json.writeValueAsBytes(definition)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private String publish(Definition definition, String digest) {
        try {
            return transaction.execute(status -> {
                if (imported(digest)) return null;
                var lesson = dictation.saveAndPublish(null, new SaveRequest(definition, 0));
                // The receipt and the lesson share a transaction so concurrent scans cannot leave duplicates.
                jdbc.update(
                    "INSERT INTO dictation_workbook_imports (content_sha256, exercise_id) VALUES (?, ?)",
                    digest,
                    lesson.id()
                );
                return lesson.id();
            });
        } catch (DuplicateKeyException ex) {
            if (imported(digest)) return null;
            throw ex;
        }
    }

    private boolean imported(String digest) {
        return !jdbc.queryForList(
            "SELECT exercise_id FROM dictation_workbook_imports WHERE content_sha256=?", String.class, digest
        ).isEmpty();
    }
}
