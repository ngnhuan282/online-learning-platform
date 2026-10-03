package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.dto.LessonRequest;
import com.elearning.course.dto.LessonResponse;
import com.elearning.course.dto.ReorderRequest;
import com.elearning.course.service.LessonService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
public class LessonController {

    private final LessonService lessonService;

    public LessonController(LessonService lessonService) {
        this.lessonService = lessonService;
    }

    @PostMapping("/sections/{sectionId}/lessons")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<LessonResponse> create(
        @PathVariable Long sectionId,
        @Valid @RequestBody LessonRequest request
    ) {
        return ApiResponse.success(lessonService.create(sectionId, request));
    }

    @PutMapping("/lessons/{lessonId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<LessonResponse> update(
        @PathVariable Long lessonId,
        @Valid @RequestBody LessonRequest request
    ) {
        return ApiResponse.success(lessonService.update(lessonId, request));
    }

    @DeleteMapping("/lessons/{lessonId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<Void> delete(@PathVariable Long lessonId) {
        lessonService.delete(lessonId);
        return ApiResponse.success(null);
    }

    @PutMapping("/sections/{sectionId}/lessons/reorder")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<Void> reorder(
        @PathVariable Long sectionId,
        @Valid @RequestBody ReorderRequest request
    ) {
        lessonService.reorder(sectionId, request);
        return ApiResponse.success(null);
    }
}
