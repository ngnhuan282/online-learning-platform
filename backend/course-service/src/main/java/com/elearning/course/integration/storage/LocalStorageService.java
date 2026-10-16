package com.elearning.course.integration.storage;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.MediaUploadResponse;
import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service("localStorageService")
public class LocalStorageService implements StorageService {

    private final Path rootLocation;

    public LocalStorageService(@Value("${storage.local-dir:./uploads}") String uploadDir) {
        this.rootLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootLocation);
        } catch (IOException e) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Không thể khởi tạo thư mục lưu trữ media: " + e.getMessage());
        }
    }

    @Override
    public MediaUploadResponse upload(MultipartFile file, String folder) {
        if (file.isEmpty()) {
            throw new AppException(ErrorCode.BAD_REQUEST, "File tải lên không được rỗng");
        }

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "file");
        String extension = "";
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = originalFilename.substring(dotIndex);
        }

        String safeFolder = folder != null && !folder.isBlank() ? folder.replaceAll("[^a-zA-Z0-9_-]", "") : "media";
        String objectKey = safeFolder + "/" + UUID.randomUUID() + extension;

        try {
            Path targetPath = this.rootLocation.resolve(objectKey).normalize();
            Files.createDirectories(targetPath.getParent());
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            String downloadUrl = "/api/v1/media/download/" + objectKey;
            return new MediaUploadResponse(
                objectKey,
                downloadUrl,
                originalFilename,
                file.getSize(),
                file.getContentType()
            );
        } catch (IOException e) {
            throw new AppException(ErrorCode.INTERNAL_ERROR, "Lỗi khi lưu trữ file: " + e.getMessage());
        }
    }

    @Override
    public void delete(String objectKey) {
        try {
            Path filePath = this.rootLocation.resolve(objectKey).normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException ignored) {}
    }

    @Override
    public String getDownloadUrl(String objectKey) {
        return "/api/v1/media/download/" + objectKey;
    }

    private static final String SIGNING_SECRET = "learnsphere-local-storage-secret-key-2026";

    @Override
    public String generatePresignedUrl(String objectKey, Duration duration) {
        long durationMs = (duration != null ? duration.toMillis() : Duration.ofMinutes(30).toMillis());
        long expires = System.currentTimeMillis() + durationMs;
        String token = computeHmac(objectKey + ":" + expires, SIGNING_SECRET);
        return "/api/v1/media/download/" + objectKey + "?expires=" + expires + "&token=" + token;
    }

    @Override
    public boolean verifySignedToken(String objectKey, Long expires, String token) {
        if (expires == null || token == null) {
            return false;
        }
        if (System.currentTimeMillis() > expires) {
            return false;
        }
        String expected = computeHmac(objectKey + ":" + expires, SIGNING_SECRET);
        return expected.equals(token);
    }

    private String computeHmac(String data, String key) {
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(key.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] bytes = mac.doFinal(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(bytes);
        } catch (Exception e) {
            return Integer.toHexString((data + key).hashCode());
        }
    }

    @Override
    public Resource loadAsResource(String objectKey) {
        try {
            Path filePath = this.rootLocation.resolve(objectKey).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy file: " + objectKey);
            }
        } catch (MalformedURLException e) {
            throw new AppException(ErrorCode.NOT_FOUND, "Đường dẫn file không hợp lệ: " + e.getMessage());
        }
    }
}
