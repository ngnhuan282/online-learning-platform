package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.common.response.PageResponse;
import com.elearning.course.dto.CourseRequest;
import com.elearning.course.dto.CourseResponse;
import com.elearning.course.service.CourseService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class CourseController {

    private final CourseService courses;

    public CourseController(CourseService courses) {
        this.courses = courses;
    }

    @GetMapping("/courses")
    public ApiResponse<PageResponse<CourseResponse>> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(required = false) String keyword
    ) {
        Page<CourseResponse> result = courses.list(page, size, keyword);
        return ApiResponse.success(PageResponse.from(result));
    }

    @GetMapping("/courses/{id}")
    public ApiResponse<CourseResponse> get(@PathVariable Long id) {
        return ApiResponse.success(courses.get(id));
    }

    @PostMapping("/admin/courses")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_CREATE')")
    public ApiResponse<CourseResponse> create(@Valid @RequestBody CourseRequest request) {
        return ApiResponse.success(courses.create(request));
    }

    @GetMapping("/admin/courses")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_VIEW')")
    public ApiResponse<PageResponse<CourseResponse>> adminList(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(PageResponse.from(courses.adminList(page, size)));
    }

    @PutMapping("/admin/courses/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<CourseResponse> update(@PathVariable Long id, @Valid @RequestBody CourseRequest request) {
        return ApiResponse.success(courses.update(id, request));
    }

    @DeleteMapping("/admin/courses/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        courses.delete(id);
        return ApiResponse.success(null);
    }
}
