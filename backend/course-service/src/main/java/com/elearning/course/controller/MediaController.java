package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.dto.MediaUploadResponse;
import com.elearning.course.integration.storage.StorageService;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
public class MediaController {

    private final StorageService storageService;

    /**
     * Upload file media (Video, Thumbnail, Document).
     * Chỉ dành cho ADMIN.
     */
    @PostMapping(value = "/api/v1/admin/media/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE') or hasAuthority('COURSE_CREATE')")
    public ApiResponse<MediaUploadResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "media") String folder) {
        MediaUploadResponse response = storageService.upload(file, folder);
        return ApiResponse.success(response);
    }

    /**
     * Tải về hoặc stream file lưu trữ cục bộ.
     */
    @GetMapping("/api/v1/media/download/{folder}/{filename:.+}")
    public ResponseEntity<?> downloadLocal(
            @PathVariable String folder,
            @PathVariable String filename,
            @RequestParam(value = "expires", required = false) Long expires,
            @RequestParam(value = "token", required = false) String token,
            HttpServletRequest request) {
        String objectKey = folder + "/" + filename;

        // Nếu có tham số bảo vệ (expires hoặc token), kiểm tra tính hợp lệ
        if (expires != null || token != null) {
            if (!storageService.verifySignedToken(objectKey, expires, token)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"code\":40301,\"message\":\"Link truy cập đã hết hạn hoặc không hợp lệ\",\"result\":null}");
            }
        }

        String downloadUrl = storageService.getDownloadUrl(objectKey);
        if (downloadUrl.startsWith("https://") || downloadUrl.startsWith("http://")) {
            return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(downloadUrl)).build();
        }

        Resource resource = storageService.loadAsResource(objectKey);

        String contentType = null;
        try {
            contentType = request.getServletContext().getMimeType(resource.getFile().getAbsolutePath());
        } catch (IOException ignored) {
        }

        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }
}
