package com.elearning.course.service;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.ReviewRequest;
import com.elearning.course.dto.ReviewResponse;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.Review;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.repository.ReviewRepository;
import com.elearning.course.security.CourseContentAccess;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final CourseRepository courseRepository;
    private final CourseContentAccess access;

    public ReviewService(
        ReviewRepository reviewRepository,
        CourseRepository courseRepository,
        CourseContentAccess access
    ) {
        this.reviewRepository = reviewRepository;
        this.courseRepository = courseRepository;
        this.access = access;
    }

    /**
     * Public: danh sách review không ẩn, sắp xếp mới nhất.
     */
    @Transactional(readOnly = true)
    public Page<ReviewResponse> listPublic(Long courseId, int page, int size) {
        Course course = courseRepository.findById(courseId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        access.requirePublished(course);
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return reviewRepository.findByCourseIdAndHiddenFalse(courseId, pageable)
            .map(ReviewResponse::from);
    }

    /**
     * Admin: danh sách tất cả review (kể cả ẩn).
     */
    @Transactional(readOnly = true)
    public Page<ReviewResponse> listAll(Long courseId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return reviewRepository.findByCourseId(courseId, pageable)
            .map(ReviewResponse::from);
    }

    /**
     * Admin: danh sách tất cả review toàn hệ thống.
     */
    @Transactional(readOnly = true)
    public Page<ReviewResponse> listAll(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return reviewRepository.findAll(pageable)
            .map(ReviewResponse::from);
    }

    /**
     * User tạo review. Chỉ 1 review / user / course.
     */
    @Transactional
    public ReviewResponse create(Long courseId, Long userId, ReviewRequest request) {
        verifyEnrollment(userId, courseId);

        if (reviewRepository.existsByCourseIdAndUserId(courseId, userId)) {
            throw new AppException(ErrorCode.CONFLICT, "Bạn đã đánh giá khóa học này rồi");
        }

        Course course = courseRepository.findById(courseId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy khóa học"));

        Review review = new Review();
        review.setCourse(course);
        review.setUserId(userId);
        if (request.userFullName() != null && !request.userFullName().isBlank()) {
            review.setUserFullName(request.userFullName());
        }
        review.setRating(request.rating());
        review.setComment(request.comment());
        reviewRepository.save(review);

        recalculateRating(course);

        return ReviewResponse.from(review);
    }

    /**
     * User sửa review của chính mình.
     */
    @Transactional
    public ReviewResponse update(Long courseId, Long reviewId, Long userId, ReviewRequest request) {
        Review review = findAndVerifyOwnership(reviewId, userId);

        if (!review.getCourse().getId().equals(courseId)) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Review không thuộc khóa học này");
        }

        if (request.userFullName() != null && !request.userFullName().isBlank()) {
            review.setUserFullName(request.userFullName());
        }
        review.setRating(request.rating());
        review.setComment(request.comment());
        reviewRepository.save(review);

        recalculateRating(review.getCourse());

        return ReviewResponse.from(review);
    }

    /**
     * User xóa review của chính mình.
     */
    @Transactional
    public void delete(Long courseId, Long reviewId, Long userId) {
        Review review = findAndVerifyOwnership(reviewId, userId);

        if (!review.getCourse().getId().equals(courseId)) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Review không thuộc khóa học này");
        }

        Course course = review.getCourse();
        reviewRepository.delete(review);
        recalculateRating(course);
    }

    /**
     * Admin thay đổi trạng thái ẩn/hiện review.
     */
    @Transactional
    public ReviewResponse setVisibility(Long reviewId, boolean hidden) {
        Review review = reviewRepository.findById(reviewId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy đánh giá"));
        review.setHidden(hidden);
        reviewRepository.save(review);
        recalculateRating(review.getCourse());
        return ReviewResponse.from(review);
    }

    /**
     * Admin ẩn review vi phạm.
     */
    @Transactional
    public ReviewResponse hide(Long courseId, Long reviewId) {
        Review review = findByCourseAndId(courseId, reviewId);
        review.setHidden(true);
        reviewRepository.save(review);
        recalculateRating(review.getCourse());
        return ReviewResponse.from(review);
    }

    /**
     * Admin bỏ ẩn review.
     */
    @Transactional
    public ReviewResponse show(Long courseId, Long reviewId) {
        Review review = findByCourseAndId(courseId, reviewId);
        review.setHidden(false);
        reviewRepository.save(review);
        recalculateRating(review.getCourse());
        return ReviewResponse.from(review);
    }

    /**
     * Lấy review của user hiện tại cho một khóa học (nếu có).
     */
    @Transactional(readOnly = true)
    public ReviewResponse getMyReview(Long courseId, Long userId) {
        return reviewRepository.findByCourseIdAndUserId(courseId, userId)
            .map(ReviewResponse::from)
            .orElse(null);
    }

    // ── Helpers ──────────────────────────────────────────────

    private void recalculateRating(Course course) {
        double avg = reviewRepository.avgRatingByCourseId(course.getId());
        int count = reviewRepository.countByCourseId(course.getId());
        course.setAvgRating(Math.round(avg * 10.0) / 10.0); // 1 decimal
        course.setReviewCount(count);
        courseRepository.save(course);
    }

    private Review findAndVerifyOwnership(Long reviewId, Long userId) {
        Review review = reviewRepository.findById(reviewId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy đánh giá"));
        if (!review.getUserId().equals(userId)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Bạn không có quyền thao tác đánh giá này");
        }
        return review;
    }

    private Review findByCourseAndId(Long courseId, Long reviewId) {
        Review review = reviewRepository.findById(reviewId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy đánh giá"));
        if (!review.getCourse().getId().equals(courseId)) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Review không thuộc khóa học này");
        }
        return review;
    }

    /**
     * Xác thực người dùng đã đăng ký khóa học thông qua Learning Service.
     */
    private void verifyEnrollment(Long userId, Long courseId) {
        if (userId == null) {
            throw new AppException(ErrorCode.FORBIDDEN, "Cần đăng nhập để đánh giá khóa học");
        }
        Course course = courseRepository.findById(courseId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (!access.canReadPrivate(course)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Bạn cần đăng ký khóa học này trước khi viết đánh giá");
        }
    }
}
