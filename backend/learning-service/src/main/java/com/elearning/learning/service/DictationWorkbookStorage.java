package com.elearning.learning.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.util.Locale;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

@Component
public class DictationWorkbookStorage {

    static final String LEGACY_ADMIN_FOLDER = "_admin/";
    static final String CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final String storageType;
    private final Path local;
    private final S3Client cloud;
    private final String bucket;
    private final String cloudPrefix;

    public DictationWorkbookStorage(
        ObjectProvider<S3Client> s3,
        @Value("${dictation.workbook-storage}") String storage,
        @Value("${dictation.storage-dir}") String localRoot,
        @Value("${dictation.s3.bucket}") String bucket,
        @Value("${dictation.s3.prefix}") String prefix
    ) {
        this.storageType = switch (storage) {
            case "local", "s3" -> storage;
            default -> throw new IllegalArgumentException("DICTATION_WORKBOOK_STORAGE must be local or s3");
        };
        this.local = Path.of(localRoot).toAbsolutePath().normalize().resolve("workbooks");
        this.bucket = bucket.strip();
        if ("s3".equals(storageType)) {
            S3Client client = s3.getIfAvailable();
            if (client == null) {
                throw new IllegalArgumentException("S3 workbook storage requires DICTATION_S3_IMPORT_ENABLED=true");
            }
            if (this.bucket.isBlank() || prefix.isBlank() || prefix.strip().equals("/")) {
                throw new IllegalArgumentException("S3 workbook storage requires AWS_S3_BUCKET and a non-empty DICTATION_S3_PREFIX");
            }
            this.cloud = client;
            this.cloudPrefix = DictationS3WorkbookImporter.directoryPrefix(prefix);
        } else {
            this.cloud = null;
            this.cloudPrefix = "";
        }
    }

    String storageType() {
        return storageType;
    }

    String suggestedKey(String id, String title, boolean fullId) {
        String slug = slugify(title);
        String suffix = fullId || id.length() <= 8 ? id : id.substring(0, 8);
        String filename = (slug.isEmpty() ? "dictation" : slug) + "-" + suffix + ".xlsx";
        return cloudPrefix + filename;
    }

    void write(String objectKey, byte[] workbook) throws IOException {
        if (workbook == null) {
            delete(objectKey);
            return;
        }
        if (cloud != null) {
            cloud.putObject(
                request -> request.bucket(bucket).key(objectKey).contentType(CONTENT_TYPE),
                RequestBody.fromBytes(workbook)
            );
            return;
        }
        Path destination = resolveLocalPath(objectKey);
        Files.createDirectories(destination.getParent());
        Path temporary = Files.createTempFile(destination.getParent(), "workbook-", ".part");
        try {
            Files.write(temporary, workbook);
            Files.move(temporary, destination, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    void delete(String objectKey) throws IOException {
        if (cloud != null) {
            cloud.deleteObject(request -> request.bucket(bucket).key(objectKey));
            return;
        }
        Files.deleteIfExists(resolveLocalPath(objectKey));
    }

    byte[] read(String objectKey) throws IOException {
        if (cloud != null) {
            try (var stream = cloud.getObject(request -> request.bucket(bucket).key(objectKey))) {
                byte[] workbook = stream.readNBytes(DictationWorkbookService.MAX_WORKBOOK_BYTES + 1);
                if (workbook.length > DictationWorkbookService.MAX_WORKBOOK_BYTES) {
                    stream.abort();
                    throw new IOException("Managed workbook is too large");
                }
                return workbook;
            } catch (NoSuchKeyException missing) {
                return null;
            }
        }
        try (var stream = Files.newInputStream(resolveLocalPath(objectKey))) {
            byte[] workbook = stream.readNBytes(DictationWorkbookService.MAX_WORKBOOK_BYTES + 1);
            if (workbook.length > DictationWorkbookService.MAX_WORKBOOK_BYTES) {
                throw new IOException("Managed workbook is too large");
            }
            return workbook;
        } catch (java.nio.file.NoSuchFileException missing) {
            return null;
        }
    }

    private Path resolveLocalPath(String objectKey) throws IOException {
        Path resolved = local.resolve(objectKey).normalize();
        if (!resolved.startsWith(local) || resolved.equals(local)) {
            throw new IOException("Invalid local workbook path");
        }
        return resolved;
    }

    private static String slugify(String title) {
        if (title == null) return "";
        String normalized = Normalizer.normalize(title.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
            .replaceAll("\\p{M}+", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-+|-+$", "");
        if (normalized.length() <= 60) return normalized;
        return normalized.substring(0, 60).replaceAll("-+$", "");
    }
}
