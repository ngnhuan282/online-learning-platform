package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.dto.ReorderRequest;
import com.elearning.course.dto.SectionRequest;
import com.elearning.course.dto.SectionResponse;
import com.elearning.course.service.SectionService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class SectionController {

    private final SectionService sectionService;

    public SectionController(SectionService sectionService) {
        this.sectionService = sectionService;
    }

    /** Public — Guest/User đều xem được curriculum của course */
    @GetMapping("/courses/{courseId}/sections")
    public ApiResponse<List<SectionResponse>> list(@PathVariable Long courseId) {
        return ApiResponse.success(sectionService.listByCourse(courseId));
    }

    @PostMapping("/admin/courses/{courseId}/sections")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<SectionResponse> create(
        @PathVariable Long courseId,
        @Valid @RequestBody SectionRequest request
    ) {
        return ApiResponse.success(sectionService.create(courseId, request));
    }

    @PutMapping("/admin/courses/{courseId}/sections/{sectionId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<SectionResponse> update(
        @PathVariable Long courseId,
        @PathVariable Long sectionId,
        @Valid @RequestBody SectionRequest request
    ) {
        return ApiResponse.success(sectionService.update(courseId, sectionId, request));
    }

    @DeleteMapping("/admin/courses/{courseId}/sections/{sectionId}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<Void> delete(
        @PathVariable Long courseId,
        @PathVariable Long sectionId
    ) {
        sectionService.delete(courseId, sectionId);
        return ApiResponse.success(null);
    }

    @PutMapping("/admin/courses/{courseId}/sections/reorder")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<Void> reorder(
        @PathVariable Long courseId,
        @Valid @RequestBody ReorderRequest request
    ) {
        sectionService.reorder(courseId, request);
        return ApiResponse.success(null);
    }
}
