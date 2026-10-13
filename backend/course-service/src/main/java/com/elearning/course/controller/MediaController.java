package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.dto.MediaUploadResponse;
import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.entity.CourseStatus;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.security.CourseContentAccess;
import com.elearning.course.security.MediaTickets;
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
    private final CourseRepository courses;
    private final CourseContentAccess access;
    private final MediaTickets tickets;

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
        return ApiResponse.success(new MediaUploadResponse(
            response.objectKey(), tickets.signLocalUrl(response.url()), response.fileName(),
            response.fileSize(), response.contentType()
        ));
    }

    /**
     * Tải về hoặc stream file lưu trữ cục bộ.
     */
    @GetMapping("/api/v1/media/download/{folder}/{filename:.+}")
    public ResponseEntity<?> downloadLocal(
            @PathVariable String folder,
            @PathVariable String filename,
            HttpServletRequest request) {
        String objectKey = folder + "/" + filename;
        boolean publicThumbnail = courses.existsByThumbnailUrlAndStatus(
            MediaTickets.DOWNLOAD_PREFIX + objectKey, CourseStatus.PUBLISHED
        ) || courses.existsByThumbnailUrlStartingWithAndStatus(
            MediaTickets.DOWNLOAD_PREFIX + objectKey + "?", CourseStatus.PUBLISHED
        );
        if (!publicThumbnail && !access.isEditor() && !tickets.valid(
                objectKey, request.getParameter("expires"), request.getParameter("signature"))) {
            throw new AppException(ErrorCode.FORBIDDEN, "Request an authorized media URL before downloading");
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
