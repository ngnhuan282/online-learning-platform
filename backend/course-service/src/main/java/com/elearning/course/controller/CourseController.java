package com.elearning.course.controller;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.common.response.PageResponse;
import com.elearning.course.dto.CourseRequest;
import com.elearning.course.dto.CourseResponse;
import com.elearning.course.entity.CourseLevel;
import com.elearning.course.service.CourseService;
import jakarta.validation.Valid;
import java.util.Locale;
import java.math.BigDecimal;
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
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Long categoryId,
        @RequestParam(required = false) String level,
        @RequestParam(defaultValue = "newest") String sort,
        @RequestParam(required = false) BigDecimal minPrice,
        @RequestParam(required = false) BigDecimal maxPrice,
        @RequestParam(required = false) Double minRating,
        @RequestParam(required = false) String pricing
    ) {
        CourseLevel parsedLevel = parseLevel(level);
        Page<CourseResponse> result = minPrice == null && maxPrice == null && minRating == null && pricing == null
            ? courses.list(page, size, keyword, categoryId, parsedLevel, sort)
            : courses.list(page, size, keyword, categoryId, parsedLevel, sort, minPrice, maxPrice, minRating, pricing);
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
    public ApiResponse<CourseResponse> update(
        @PathVariable Long id,
        @Valid @RequestBody CourseRequest request
    ) {
        return ApiResponse.success(courses.update(id, request));
    }

    @GetMapping("/admin/courses/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_VIEW')")
    public ApiResponse<CourseResponse> adminGet(@PathVariable Long id) {
        return ApiResponse.success(courses.adminGet(id));
    }

    @DeleteMapping("/admin/courses/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        courses.delete(id);
        return ApiResponse.success(null);
    }

    private CourseLevel parseLevel(String level) {
        if (level == null || level.isBlank()) {
            return null;
        }
        try {
            return CourseLevel.valueOf(level.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
    }
}
