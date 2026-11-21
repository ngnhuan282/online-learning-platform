package com.elearning.learning.service;

import com.elearning.learning.common.exception.*;
import com.elearning.learning.dto.DictationModels.Audio;
import com.mpatric.mp3agic.Mp3File;
import java.io.IOException;
import java.nio.file.*;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DictationAudioService {

    private final JdbcTemplate jdbc;
    private final Path root;

    public DictationAudioService(
        JdbcTemplate jdbc,
        @Value("${dictation.storage-dir:./uploads/dictation}") String root
    ) {
        this.jdbc = jdbc;
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    public Audio upload(MultipartFile file) {
        if (
            file.isEmpty() ||
            file.getSize() > 25L * 1024 * 1024 ||
            file.getOriginalFilename() == null ||
            !file.getOriginalFilename().toLowerCase(java.util.Locale.ROOT).endsWith(".mp3")
        ) {
            throw new DictationValidationException("Vui lòng chọn audio MP3 không quá 25 MB.");
        }
        String key = UUID.randomUUID() + ".mp3";
        Path path = root.resolve(key);
        try {
            Files.createDirectories(root);
            file.transferTo(path);
            var mp3 = new Mp3File(path.toString());
            double duration = mp3.getLengthInMilliseconds() / 1000.0;
            if (!Double.isFinite(duration) || duration <= 0 || duration > 3600) {
                throw new DictationValidationException("Audio phải có thời lượng từ 1 giây đến 60 phút.");
            }
            String name = Path.of(file.getOriginalFilename().replace('\\', '/')).getFileName().toString();
            if (name.length() > 180) name = name.substring(name.length() - 180);
            jdbc.update(
                "INSERT INTO dictation_audio (audio_key, original_name, duration_seconds) VALUES (?, ?, ?)",
                key,
                name,
                duration
            );
            return new Audio(key, duration, name);
        } catch (Exception ex) {
            try {
                Files.deleteIfExists(path);
            } catch (IOException ignored) {
                /* Unreferenced upload only. */
            }
            if (ex instanceof DictationValidationException validation) throw validation;
            throw new DictationValidationException("Không thể đọc audio MP3. Vui lòng kiểm tra lại file.");
        }
    }

    public Audio metadata(String key) {
        if (key == null || key.isBlank()) return null;
        return jdbc
            .query(
                "SELECT * FROM dictation_audio WHERE audio_key = ?",
                (rs, row) ->
                    new Audio(
                        rs.getString("audio_key"),
                        rs.getDouble("duration_seconds"),
                        rs.getString("original_name")
                    ),
                key
            )
            .stream()
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    public Resource resource(String key) {
        if (metadata(key) == null) throw new AppException(ErrorCode.NOT_FOUND);
        Path path = root.resolve(key).normalize();
        if (!root.equals(path.getParent()) || !Files.isRegularFile(path)) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        return new FileSystemResource(path);
    }
}
