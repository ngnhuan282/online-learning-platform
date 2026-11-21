package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.common.response.PageResponse;
import com.elearning.learning.dto.ToeicModels.Question;
import com.mpatric.mp3agic.Mp3File;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.*;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ToeicMediaService {

    public static final String MEDIA_PATH = "/api/v1/learning/toeic/media/";
    private static final Pattern MEDIA_ID = Pattern.compile("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}");
    private static final Pattern OBJECT_KEY = Pattern.compile(MEDIA_ID + "\\.(mp3|png|jpe?g|webp)");
    private static final long MAX_BYTES = 25L * 1024 * 1024;
    private static final Logger log = LoggerFactory.getLogger(ToeicMediaService.class);

    public enum Kind {
        AUDIO,
        IMAGE,
    }

    public record Media(
        String id,
        String originalName,
        Kind kind,
        long size,
        boolean cloudCopy,
        long version,
        String url
    ) {}

    public record Library(PageResponse<Media> assets, boolean cloudEnabled) {}

    public record Delivery(String contentType, long size, Resource file, URI redirect) {}

    private record Blob(String key, boolean cloudCopy) {}

    private record Asset(
        String id,
        String originalName,
        Kind kind,
        String contentType,
        long size,
        Blob blob,
        long version
    ) {
        Media view() {
            return new Media(id, originalName, kind, size, blob.cloudCopy(), version, MEDIA_PATH + id);
        }
    }

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final Path root;
    private final ToeicS3MediaStorage s3;

    public ToeicMediaService(
        JdbcTemplate jdbc,
        Clock clock,
        ToeicS3MediaStorage s3,
        @Value("${toeic.media.local-dir:./uploads/toeic}") String root
    ) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.s3 = s3;
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    public static boolean isManagedPath(String path) {
        return (
            path != null &&
            path.startsWith(MEDIA_PATH) &&
            MEDIA_ID.matcher(path.substring(MEDIA_PATH.length())).matches()
        );
    }

    @Transactional(readOnly = true)
    public Library list(Kind kind, int page, int size) {
        if (page < 0 || size < 1 || size > 50) throw new AppException(ErrorCode.BAD_REQUEST);
        String firstKind = kind == null ? Kind.AUDIO.name() : kind.name();
        String lastKind = kind == null ? Kind.IMAGE.name() : firstKind;
        var rows = jdbc.query(
            """
            SELECT * FROM toeic_media WHERE media_kind IN (?, ?)
            ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
            """,
            (row, i) -> asset(row).view(),
            firstKind,
            lastKind,
            size,
            (long) page * size
        );
        long total = jdbc.queryForObject(
            "SELECT COUNT(*) FROM toeic_media WHERE media_kind IN (?, ?)",
            Long.class,
            firstKind,
            lastKind
        );
        return new Library(
            PageResponse.from(new PageImpl<>(rows, PageRequest.of(page, size), total)),
            s3.enabled()
        );
    }

    @Transactional
    public Media create(MultipartFile file, Kind kind) {
        Asset asset = store(UUID.randomUUID().toString(), file, kind, 1);
        jdbc.update(
            """
            INSERT INTO toeic_media (id, object_key, original_name, media_kind, content_type, size_bytes, cloud_copy, version, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            asset.id(),
            asset.blob().key(),
            asset.originalName(),
            asset.kind().name(),
            asset.contentType(),
            asset.size(),
            asset.blob().cloudCopy(),
            asset.version(),
            Timestamp.from(clock.instant())
        );
        return asset.view();
    }

    @Transactional
    public Media replace(UUID id, long version, MultipartFile file) {
        Asset current = editable(id, version);
        Asset replacement = store(current.id(), file, current.kind(), current.version() + 1);
        jdbc.update(
            """
            UPDATE toeic_media SET object_key = ?, original_name = ?, content_type = ?, size_bytes = ?, cloud_copy = ?, version = ?
            WHERE id = ?
            """,
            replacement.blob().key(),
            replacement.originalName(),
            replacement.contentType(),
            replacement.size(),
            replacement.blob().cloudCopy(),
            replacement.version(),
            replacement.id()
        );
        afterCommit(() -> clean(current.blob()));
        return replacement.view();
    }

    @Transactional
    public void delete(UUID id, long version) {
        Asset current = editable(id, version);
        if (current.blob().cloudCopy()) s3.delete(current.blob().key());
        deleteLocal(current.blob().key());
        jdbc.update("DELETE FROM toeic_media WHERE id = ?", current.id());
    }

    public Delivery delivery(UUID id, boolean headOnly) {
        Asset asset = find(id.toString(), false);
        Path path = localPath(asset.blob().key());
        try {
            if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) && Files.size(path) == asset.size()) {
                return new Delivery(asset.contentType(), asset.size(), new FileSystemResource(path), null);
            }
        } catch (IOException ex) {
            log.debug("Local TOEIC media is unavailable for {}", id, ex);
        }
        if (!asset.blob().cloudCopy() || !s3.enabled() || s3.size(asset.blob().key()) != asset.size()) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        URI redirect = headOnly ? null : s3.preview(asset.blob().key());
        return new Delivery(asset.contentType(), asset.size(), null, redirect);
    }

    public void lockReferences(List<Question> questions) {
        Map<String, Kind> references = new TreeMap<>();
        for (Question question : questions) {
            if (question.listening() != null) addReference(
                references,
                question.listening().audioUrl(),
                Kind.AUDIO
            );
            addReference(references, question.imageUrl(), Kind.IMAGE);
            if (question.passageImageUrls() != null) {
                question.passageImageUrls().forEach(path -> addReference(references, path, Kind.IMAGE));
            }
        }
        references.forEach((id, kind) -> {
            if (find(id, true).kind() != kind) throw new AppException(ErrorCode.TOEIC_MEDIA_INVALID);
        });
    }

    private void addReference(Map<String, Kind> references, String path, Kind kind) {
        if (!isManagedPath(path)) return;
        Kind existing = references.putIfAbsent(path.substring(MEDIA_PATH.length()), kind);
        if (existing != null && existing != kind) throw new AppException(ErrorCode.TOEIC_MEDIA_INVALID);
    }

    private Asset editable(UUID id, long version) {
        Asset current = find(id.toString(), true);
        if (current.version() != version) throw new AppException(ErrorCode.CONFLICT);
        String url = '"' + current.view().url() + '"';
        Boolean used = jdbc.queryForObject(
            """
            SELECT EXISTS (SELECT 1 FROM toeic_exams WHERE deleted = FALSE AND LOCATE(?, definition_json) > 0)
                OR EXISTS (SELECT 1 FROM toeic_attempts WHERE LOCATE(?, snapshot_json) > 0)
            """,
            Boolean.class,
            url,
            url
        );
        if (Boolean.TRUE.equals(used)) throw new AppException(ErrorCode.TOEIC_MEDIA_IN_USE);
        if (current.blob().cloudCopy() && !s3.enabled()) throw new AppException(
            ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE
        );
        return current;
    }

    private Asset store(String id, MultipartFile file, Kind expected, long version) {
        String raw = Objects.requireNonNullElse(file.getOriginalFilename(), "").replace('\\', '/');
        String name = raw.substring(raw.lastIndexOf('/') + 1).trim();
        int dot = name.lastIndexOf('.');
        if (file.isEmpty() || file.getSize() > MAX_BYTES || dot < 1 || name.length() > 180) throw invalid();
        String extension = name.substring(dot + 1).toLowerCase(Locale.ROOT);
        String type = switch (extension) {
            case "mp3" -> "audio/mpeg";
            case "png" -> "image/png";
            case "jpeg", "jpg" -> "image/jpeg";
            case "webp" -> "image/webp";
            default -> throw invalid();
        };
        Kind kind = extension.equals("mp3") ? Kind.AUDIO : Kind.IMAGE;
        if (expected != null && kind != expected) throw invalid();
        Blob blob = new Blob(UUID.randomUUID() + "." + extension, s3.enabled());
        Path path = localPath(blob.key());
        try {
            Files.createDirectories(root);
            Path temporary = Files.createTempFile(root, "media-", ".part");
            try {
                file.transferTo(temporary);
                validateMedia(temporary, type);
                Files.move(temporary, path, StandardCopyOption.ATOMIC_MOVE);
            } finally {
                Files.deleteIfExists(temporary);
            }
        } catch (IOException ex) {
            throw new AppException(ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE, ex);
        }
        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) clean(blob);
                }
            }
        );
        if (blob.cloudCopy()) s3.put(blob.key(), path, type);
        return new Asset(id, name, kind, type, file.getSize(), blob, version);
    }

    private void validateMedia(Path file, String type) {
        try {
            if (type.equals("audio/mpeg")) {
                if (new Mp3File(file.toString()).getLengthInMilliseconds() <= 0) throw invalid();
                return;
            }
            try (var input = Files.newInputStream(file)) {
                byte[] header = input.readNBytes(12);
                boolean valid = switch (type) {
                    case "image/png" -> header.length == 12 &&
                        Arrays.equals(
                            header,
                            0,
                            8,
                            new byte[] { (byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10 },
                            0,
                            8
                        );
                    case "image/jpeg" -> header.length == 12 &&
                        (header[0] & 0xff) == 255 &&
                        (header[1] & 0xff) == 216 &&
                        (header[2] & 0xff) == 255;
                    case "image/webp" -> header.length == 12 &&
                        new String(header, 0, 4, StandardCharsets.US_ASCII).equals("RIFF") &&
                        new String(header, 8, 4, StandardCharsets.US_ASCII).equals("WEBP");
                    default -> false;
                };
                if (!valid) throw invalid();
            }
        } catch (Exception ex) {
            throw invalid();
        }
    }

    private AppException invalid() {
        return new AppException(ErrorCode.TOEIC_MEDIA_INVALID);
    }

    private Asset find(String id, boolean lock) {
        return jdbc
            .query(
                "SELECT * FROM toeic_media WHERE id = ?" + (lock ? " FOR UPDATE" : ""),
                (row, i) -> asset(row),
                id
            )
            .stream()
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private Asset asset(ResultSet row) throws SQLException {
        return new Asset(
            row.getString("id"),
            row.getString("original_name"),
            Kind.valueOf(row.getString("media_kind")),
            row.getString("content_type"),
            row.getLong("size_bytes"),
            new Blob(row.getString("object_key"), row.getBoolean("cloud_copy")),
            row.getLong("version")
        );
    }

    private Path localPath(String key) {
        if (!OBJECT_KEY.matcher(key).matches()) throw new AppException(ErrorCode.NOT_FOUND);
        return root.resolve(key);
    }

    private void deleteLocal(String key) {
        try {
            Files.deleteIfExists(localPath(key));
        } catch (IOException ex) {
            throw new AppException(ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE, ex);
        }
    }

    private void clean(Blob blob) {
        try {
            if (blob.cloudCopy()) s3.delete(blob.key());
        } catch (RuntimeException ex) {
            log.warn("Could not remove unused TOEIC cloud media {}", blob.key(), ex);
        }
        try {
            deleteLocal(blob.key());
        } catch (RuntimeException ex) {
            log.warn("Could not remove unused TOEIC local media {}", blob.key(), ex);
        }
    }

    private void afterCommit(Runnable cleanup) {
        TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    cleanup.run();
                }
            }
        );
    }
}
