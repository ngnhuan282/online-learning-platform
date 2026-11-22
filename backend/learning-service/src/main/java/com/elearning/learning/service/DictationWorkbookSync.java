package com.elearning.learning.service;

import com.elearning.learning.common.exception.DictationValidationException;
import com.elearning.learning.dto.DictationModels.Definition;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import software.amazon.awssdk.core.exception.SdkException;
import tools.jackson.databind.json.JsonMapper;

@Service
public class DictationWorkbookSync {

    private static final Logger log = LoggerFactory.getLogger(DictationWorkbookSync.class);

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final JsonMapper json;
    private final DictationWorkbookService workbooks;
    private final DictationWorkbookStorage storage;

    public DictationWorkbookSync(
        JdbcTemplate jdbc,
        PlatformTransactionManager transactions,
        JsonMapper json,
        DictationWorkbookService workbooks,
        DictationWorkbookStorage storage
    ) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(transactions);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.json = json;
        this.workbooks = workbooks;
        this.storage = storage;
    }

    String storageType() {
        return storage.storageType();
    }

    void request(String id, Integer version) {
        if (version == null) {
            jdbc.update("UPDATE dictation_workbook_sync SET version=NULL, pending=FALSE WHERE exercise_id=?", id);
            return;
        }
        jdbc.update(
            """
            INSERT INTO dictation_workbook_sync (exercise_id, version, pending)
            VALUES (?, ?, TRUE)
            ON DUPLICATE KEY UPDATE version=?, pending=TRUE
            """,
            id, version, version
        );
    }

    void syncNow(String id) {
        try {
            transaction.executeWithoutResult(status -> syncOne(id));
        } catch (RuntimeException ex) {
            log.warn("Cannot synchronize dictation workbook exerciseId={} errorType={}", id, ex.getClass().getSimpleName());
        }
    }

    @Scheduled(fixedDelay = 15_000)
    public void sync() {
        for (String id : jdbc.queryForList(
            "SELECT exercise_id FROM dictation_workbook_sync WHERE pending=TRUE ORDER BY exercise_id",
            String.class
        )) {
            syncNow(id);
        }
    }

    private void syncOne(String id) {
        var desired = jdbc.query(
            "SELECT version FROM dictation_workbook_sync WHERE exercise_id=? AND pending=TRUE FOR UPDATE",
            (rs, row) -> rs.getObject("version", Integer.class),
            id
        );
        if (desired.isEmpty()) return;
        Integer version = desired.getFirst();
        if (version == null) {
            // Older versions may have queued a workbook deletion when hiding a lesson.
            jdbc.update("UPDATE dictation_workbook_sync SET pending=FALSE WHERE exercise_id=?", id);
            return;
        }
        String activeStorage = storage.storageType();
        String existingKey = findSourceKey(id, activeStorage);
        Definition definition = definition(id, version);
        byte[] bytes = workbooks.writeLesson(definition);
        String objectKey = existingKey != null ? existingKey : resolveUniqueKey(activeStorage, id, definition.title());
        String digest = workbookDigest(bytes, definition);
        try {
            storage.write(objectKey, bytes);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
        upsertSource(id, activeStorage, objectKey, digest);
        DictationWorkbookImporter.recordImportDigest(jdbc, digest, id);
        jdbc.update("UPDATE dictation_workbook_sync SET pending=FALSE WHERE exercise_id=?", id);
    }

    byte[] download(String id, int version) {
        boolean synchronizedFile = !jdbc.queryForList(
            """
            SELECT s.exercise_id FROM dictation_workbook_sync s
            JOIN dictation_exercises e ON e.id=s.exercise_id
            WHERE s.exercise_id=? AND s.version=? AND s.pending=FALSE
                AND e.current_version=e.published_version
            """,
            String.class, id, version
        ).isEmpty();
        if (synchronizedFile) {
            String key = findSourceKey(id, storage.storageType());
            if (key != null) {
                try {
                    byte[] contents = storage.read(key);
                    if (contents != null) return contents;
                } catch (IOException | SdkException ex) {
                    log.warn(
                        "Cannot read synced dictation workbook exerciseId={} key={} error={}; falling back to database copy",
                        id,
                        key,
                        ex.getClass().getSimpleName()
                    );
                }
            }
        }
        return workbooks.writeLesson(definition(id, version));
    }

    private String findSourceKey(String id, String activeStorage) {
        return jdbc.queryForList(
            "SELECT object_key FROM dictation_workbook_sources WHERE exercise_id=? AND storage=?",
            String.class, id, activeStorage
        ).stream().findFirst().orElse(null);
    }

    private String resolveUniqueKey(String activeStorage, String id, String title) {
        String candidate = storage.suggestedKey(id, title, false);
        boolean taken = !jdbc.queryForList(
            "SELECT exercise_id FROM dictation_workbook_sources WHERE storage=? AND object_key=? AND exercise_id<>?",
            String.class, activeStorage, candidate, id
        ).isEmpty();
        return taken ? storage.suggestedKey(id, title, true) : candidate;
    }

    private String workbookDigest(byte[] bytes, Definition fallback) {
        try {
            return DictationWorkbookImporter.fingerprint(json, workbooks.parseLesson(bytes));
        } catch (DictationValidationException nonYoutubeOrPartial) {
            return DictationWorkbookImporter.fingerprint(json, fallback);
        }
    }

    private void upsertSource(String id, String activeStorage, String objectKey, String digest) {
        int updated = jdbc.update(
            "UPDATE dictation_workbook_sources SET object_key=?, content_sha256=? WHERE exercise_id=? AND storage=?",
            objectKey, digest, id, activeStorage
        );
        if (updated == 0) {
            jdbc.update(
                "INSERT INTO dictation_workbook_sources (exercise_id, storage, object_key, content_sha256) VALUES (?, ?, ?, ?)",
                id, activeStorage, objectKey, digest
            );
        }
    }

    private Definition definition(String id, int version) {
        String data = jdbc.queryForObject(
            "SELECT definition FROM dictation_revisions WHERE exercise_id=? AND version=?",
            String.class, id, version
        );
        return json.readValue(data, Definition.class);
    }
}
