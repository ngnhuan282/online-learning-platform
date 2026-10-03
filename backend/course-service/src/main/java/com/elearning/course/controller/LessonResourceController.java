package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.dto.LessonResourceRequest;
import com.elearning.course.dto.LessonResourceResponse;
import com.elearning.course.service.LessonResourceService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class LessonResourceController {

    private final LessonResourceService resourceService;

    /**
     * Lấy danh sách tài liệu đính kèm của một bài học.
     * Public endpoint.
     */
    @GetMapping("/api/v1/lessons/{lessonId}/resources")
    public ApiResponse<List<LessonResourceResponse>> getResources(@PathVariable Long lessonId) {
        List<LessonResourceResponse> resources = resourceService.getResourcesByLesson(lessonId);
        return ApiResponse.success(resources);
    }

    /**
     * Thêm tài liệu đính kèm vào bài học.
     * Quyền ADMIN.
     */
    @PostMapping("/api/v1/admin/lessons/{lessonId}/resources")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<LessonResourceResponse> addResource(
        @PathVariable Long lessonId,
        @Valid @RequestBody LessonResourceRequest request
    ) {
        LessonResourceResponse response = resourceService.addResource(lessonId, request);
        return ApiResponse.success(response);
    }

    /**
     * Xóa tài liệu đính kèm.
     * Quyền ADMIN.
     */
    @DeleteMapping("/api/v1/admin/resources/{resourceId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> deleteResource(@PathVariable Long resourceId) {
        resourceService.deleteResource(resourceId);
        return ApiResponse.success(null);
    }
}
