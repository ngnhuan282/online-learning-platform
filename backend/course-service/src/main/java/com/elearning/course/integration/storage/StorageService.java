package com.elearning.course.integration.storage;

import com.elearning.course.dto.MediaUploadResponse;
import java.time.Duration;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface StorageService {

    MediaUploadResponse upload(MultipartFile file, String folder);

    void delete(String objectKey);

    String getDownloadUrl(String objectKey);

    String generatePresignedUrl(String objectKey, Duration duration);

    Resource loadAsResource(String objectKey);

    default boolean verifySignedToken(String objectKey, Long expires, String token) {
        return true;
    }
}
