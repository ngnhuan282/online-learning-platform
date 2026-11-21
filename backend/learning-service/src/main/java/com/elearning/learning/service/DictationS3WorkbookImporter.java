package com.elearning.learning.service;

import com.elearning.learning.common.exception.DictationValidationException;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.model.S3Object;

public class DictationS3WorkbookImporter {

    private static final Logger log = LoggerFactory.getLogger(DictationS3WorkbookImporter.class);

    private final DictationWorkbookImporter workbooks;
    private final S3Client s3;
    private final ListObjectsV2Request listing;
    private final Map<String, S3Object> inspected = new HashMap<>();

    public DictationS3WorkbookImporter(DictationWorkbookImporter workbooks, S3Client s3, String bucket, String prefix) {
        if (bucket.isBlank() || prefix.isBlank() || prefix.strip().equals("/")) {
            throw new IllegalArgumentException("Dictation S3 import requires AWS_S3_BUCKET and a non-empty DICTATION_S3_PREFIX");
        }
        this.workbooks = workbooks;
        this.s3 = s3;
        this.listing = ListObjectsV2Request.builder()
            .bucket(bucket.strip())
            .prefix(directoryPrefix(prefix))
            .build();
    }

    static String directoryPrefix(String prefix) {
        String directory = prefix.strip();
        return directory.endsWith("/") ? directory : directory + "/";
    }

    @Scheduled(fixedDelay = 15_000)
    public void scan() {
        var keys = new HashSet<String>();
        try {
            for (S3Object object : s3.listObjectsV2Paginator(listing).contents()) {
                String key = object.key();
                if (key.startsWith(listing.prefix() + DictationWorkbookStorage.LEGACY_ADMIN_FOLDER)) continue;
                if (DictationWorkbookImporter.isWorkbookName(key.substring(key.lastIndexOf('/') + 1))) {
                    keys.add(key);
                    if (!object.equals(inspected.get(key))) inspect(object);
                }
            }
            inspected.keySet().retainAll(keys);
        } catch (SdkException ex) {
            log.warn("Cannot list dictation workbooks in S3 prefix={} error={}", listing.prefix(), errorCode(ex));
        }
    }

    private void inspect(S3Object object) {
        String key = object.key();
        int limit = DictationWorkbookService.MAX_WORKBOOK_BYTES;
        try {
            if (object.size() > limit) {
                throw new DictationValidationException("Tệp Excel vượt quá 5 MB.");
            }
            var request = GetObjectRequest.builder().bucket(listing.bucket()).key(key).ifMatch(object.eTag()).build();
            byte[] contents;
            try (var stream = s3.getObject(request)) {
                contents = stream.readNBytes(limit + 1);
                if (contents.length > limit) {
                    stream.abort();
                    throw new DictationValidationException("Tệp Excel vượt quá 5 MB.");
                }
            }
            if (contents.length != object.size()) {
                throw new IOException("S3 workbook size changed");
            }
            workbooks.importWorkbook(DictationWorkbookImporter.S3_STORAGE, key, contents);
        } catch (DictationValidationException invalid) {
            log.warn("Rejected dictation workbook in S3 key={} reason={}", key, invalid.getMessage());
        } catch (IOException | RuntimeException ex) {
            log.warn("Cannot import dictation workbook from S3 key={} error={}", key, errorCode(ex));
            return;
        }
        inspected.put(key, object);
    }

    private static String errorCode(Exception ex) {
        return ex instanceof S3Exception failure ? "HTTP " + failure.statusCode() : ex.getClass().getSimpleName();
    }
}
