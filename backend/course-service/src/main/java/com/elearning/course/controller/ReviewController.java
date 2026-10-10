package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.common.response.PageResponse;
import com.elearning.course.dto.ReviewRequest;
import com.elearning.course.dto.ReviewResponse;
import com.elearning.course.service.ReviewService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    /**
     * Public: danh sách review (không ẩn) của khóa học, phân trang.
     */
    @GetMapping("/courses/{courseId}/reviews")
    public ApiResponse<PageResponse<ReviewResponse>> list(
        @PathVariable Long courseId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size
    ) {
        Page<ReviewResponse> result = reviewService.listPublic(courseId, page, size);
        return ApiResponse.success(PageResponse.from(result));
    }

    /**
     * User: tạo review cho khóa học. Chỉ 1 review / user / course.
     */
    @PostMapping("/courses/{courseId}/reviews")
    public ApiResponse<ReviewResponse> create(
        @PathVariable Long courseId,
        @Valid @RequestBody ReviewRequest request,
        Authentication authentication
    ) {
        Long userId = Long.parseLong(authentication.getName());
        return ApiResponse.success(reviewService.create(courseId, userId, request));
    }

    /**
     * User: sửa review của chính mình.
     */
    @PutMapping("/courses/{courseId}/reviews/{reviewId}")
    public ApiResponse<ReviewResponse> update(
        @PathVariable Long courseId,
        @PathVariable Long reviewId,
        @Valid @RequestBody ReviewRequest request,
        Authentication authentication
    ) {
        Long userId = Long.parseLong(authentication.getName());
        return ApiResponse.success(reviewService.update(courseId, reviewId, userId, request));
    }

    /**
     * User: xóa review của chính mình.
     */
    @DeleteMapping("/courses/{courseId}/reviews/{reviewId}")
    public ApiResponse<Void> delete(
        @PathVariable Long courseId,
        @PathVariable Long reviewId,
        Authentication authentication
    ) {
        Long userId = Long.parseLong(authentication.getName());
        reviewService.delete(courseId, reviewId, userId);
        return ApiResponse.success(null);
    }

    /**
     * User: xem review của mình cho khóa học này (nếu có).
     */
    @GetMapping("/courses/{courseId}/reviews/me")
    public ApiResponse<ReviewResponse> myReview(
        @PathVariable Long courseId,
        Authentication authentication
    ) {
        Long userId = Long.parseLong(authentication.getName());
        return ApiResponse.success(reviewService.getMyReview(courseId, userId));
    }

    // ── Admin ────────────────────────────────────────────

    /**
     * Admin: danh sách tất cả review (kể cả ẩn) của khóa học.
     */
    @GetMapping("/admin/courses/{courseId}/reviews")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_VIEW')")
    public ApiResponse<PageResponse<ReviewResponse>> adminList(
        @PathVariable Long courseId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        Page<ReviewResponse> result = reviewService.listAll(courseId, page, size);
        return ApiResponse.success(PageResponse.from(result));
    }

    /**
     * Admin: ẩn review vi phạm.
     */
    @PutMapping("/admin/courses/{courseId}/reviews/{reviewId}/hide")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<ReviewResponse> hide(
        @PathVariable Long courseId,
        @PathVariable Long reviewId
    ) {
        return ApiResponse.success(reviewService.hide(courseId, reviewId));
    }

    /**
     * Admin: bỏ ẩn review.
     */
    @PutMapping("/admin/courses/{courseId}/reviews/{reviewId}/show")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('COURSE_UPDATE')")
    public ApiResponse<ReviewResponse> show(
        @PathVariable Long courseId,
        @PathVariable Long reviewId
    ) {
        return ApiResponse.success(reviewService.show(courseId, reviewId));
    }
}
