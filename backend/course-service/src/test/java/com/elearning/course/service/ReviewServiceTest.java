package com.elearning.course.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.ReviewRequest;
import com.elearning.course.dto.ReviewResponse;
import com.elearning.course.entity.Category;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.Review;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.repository.ReviewRepository;
import com.elearning.course.security.CourseContentAccess;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock
    private ReviewRepository reviewRepository;

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private com.elearning.course.integration.learning.EnrollmentClient enrollmentClient;

    @InjectMocks
    private ReviewService reviewService;

    private Course sampleCourse;

    @BeforeEach
    void setUp() {
        Category category = new Category();
        category.setId(1L);
        category.setName("Programming");

        sampleCourse = new Course();
        sampleCourse.setId(10L);
        sampleCourse.setTitle("Spring Boot Masterclass");
        sampleCourse.setCategory(category);
        sampleCourse.setPrice(BigDecimal.valueOf(100000));
        sampleCourse.setCreatedAt(Instant.now());
        sampleCourse.setUpdatedAt(Instant.now());
    }

    @Test
    void create_success_recalculatesRating() {
        Long courseId = 10L;
        Long userId = 42L;
        ReviewRequest request = new ReviewRequest(5, "Tuyệt vời!");

        when(enrollmentClient.isEnrolled(userId, courseId)).thenReturn(true);
        when(reviewRepository.existsByCourseIdAndUserId(courseId, userId)).thenReturn(false);
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(sampleCourse));
        when(access.canReadPrivate(sampleCourse)).thenReturn(true);
        when(reviewRepository.avgRatingByCourseId(courseId)).thenReturn(5.0);
        when(reviewRepository.countByCourseId(courseId)).thenReturn(1);

        ReviewResponse response = reviewService.create(courseId, userId, request);

        assertThat(response).isNotNull();
        assertThat(response.courseId()).isEqualTo(10L);
        assertThat(response.userId()).isEqualTo(42L);
        assertThat(response.rating()).isEqualTo(5);
        assertThat(response.comment()).isEqualTo("Tuyệt vời!");

        verify(reviewRepository).save(any(Review.class));
        verify(courseRepository).save(sampleCourse);
        assertThat(sampleCourse.getAvgRating()).isEqualTo(5.0);
        assertThat(sampleCourse.getReviewCount()).isEqualTo(1);
    }

    @Test
    void create_notEnrolled_throwsForbidden() {
        Long courseId = 10L;
        Long userId = 42L;
        ReviewRequest request = new ReviewRequest(5, "Tuyệt vời!");

        when(enrollmentClient.isEnrolled(userId, courseId)).thenReturn(false);

        assertThatThrownBy(() -> reviewService.create(courseId, userId, request))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
    }

    @Test
    void create_duplicateReview_throwsConflict() {
        Long courseId = 10L;
        Long userId = 42L;
        ReviewRequest request = new ReviewRequest(4, "Khóa học hay");

        when(enrollmentClient.isEnrolled(userId, courseId)).thenReturn(true);
        when(reviewRepository.existsByCourseIdAndUserId(courseId, userId)).thenReturn(true);
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(sampleCourse));
        when(access.canReadPrivate(sampleCourse)).thenReturn(true);

        assertThatThrownBy(() -> reviewService.create(courseId, userId, request))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONFLICT);

        verify(reviewRepository, never()).save(any());
    }

    @Test
    void create_courseNotFound_throwsNotFound() {
        Long courseId = 999L;
        Long userId = 42L;
        ReviewRequest request = new ReviewRequest(4, "Good");

        when(enrollmentClient.isEnrolled(userId, courseId)).thenReturn(true);
        when(reviewRepository.existsByCourseIdAndUserId(courseId, userId)).thenReturn(false);
        when(courseRepository.findById(courseId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.create(courseId, userId, request))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    void update_success_recalculatesRating() {
        Long courseId = 10L;
        Long reviewId = 100L;
        Long userId = 42L;
        ReviewRequest request = new ReviewRequest(4, "Nội dung cập nhật");

        Review existing = new Review();
        existing.setId(reviewId);
        existing.setCourse(sampleCourse);
        existing.setUserId(userId);
        existing.setRating(5);
        existing.setComment("Cũ");

        when(reviewRepository.findById(reviewId)).thenReturn(Optional.of(existing));
        when(reviewRepository.avgRatingByCourseId(courseId)).thenReturn(4.0);
        when(reviewRepository.countByCourseId(courseId)).thenReturn(1);

        ReviewResponse response = reviewService.update(courseId, reviewId, userId, request);

        assertThat(response.rating()).isEqualTo(4);
        assertThat(response.comment()).isEqualTo("Nội dung cập nhật");
        verify(reviewRepository).save(existing);
        verify(courseRepository).save(sampleCourse);
    }

    @Test
    void update_notOwner_throwsForbidden() {
        Long courseId = 10L;
        Long reviewId = 100L;
        Long otherUserId = 99L;
        ReviewRequest request = new ReviewRequest(4, "Hacked comment");

        Review existing = new Review();
        existing.setId(reviewId);
        existing.setCourse(sampleCourse);
        existing.setUserId(42L); // Owner is 42

        when(reviewRepository.findById(reviewId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> reviewService.update(courseId, reviewId, otherUserId, request))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
    }

    @Test
    void delete_success_recalculatesRating() {
        Long courseId = 10L;
        Long reviewId = 100L;
        Long userId = 42L;

        Review existing = new Review();
        existing.setId(reviewId);
        existing.setCourse(sampleCourse);
        existing.setUserId(userId);

        when(reviewRepository.findById(reviewId)).thenReturn(Optional.of(existing));
        when(reviewRepository.avgRatingByCourseId(courseId)).thenReturn(0.0);
        when(reviewRepository.countByCourseId(courseId)).thenReturn(0);

        reviewService.delete(courseId, reviewId, userId);

        verify(reviewRepository).delete(existing);
        verify(courseRepository).save(sampleCourse);
        assertThat(sampleCourse.getAvgRating()).isEqualTo(0.0);
        assertThat(sampleCourse.getReviewCount()).isEqualTo(0);
    }

    @Test
    void hide_and_show_adminOperations() {
        Long courseId = 10L;
        Long reviewId = 100L;

        Review existing = new Review();
        existing.setId(reviewId);
        existing.setCourse(sampleCourse);
        existing.setHidden(false);

        when(reviewRepository.findById(reviewId)).thenReturn(Optional.of(existing));

        ReviewResponse hiddenRes = reviewService.hide(courseId, reviewId);
        assertThat(hiddenRes.hidden()).isTrue();
        assertThat(existing.isHidden()).isTrue();

        ReviewResponse shownRes = reviewService.show(courseId, reviewId);
        assertThat(shownRes.hidden()).isFalse();
        assertThat(existing.isHidden()).isFalse();
    }

    @Test
    void listPublic_returnsNonHiddenReviews() {
        Long courseId = 10L;
        Review rev = new Review();
        rev.setId(1L);
        rev.setCourse(sampleCourse);
        rev.setUserId(42L);
        rev.setRating(5);
        rev.setHidden(false);

        when(reviewRepository.findByCourseIdAndHiddenFalse(eq(courseId), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(rev)));
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(sampleCourse));

        Page<ReviewResponse> page = reviewService.listPublic(courseId, 0, 10);
        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).rating()).isEqualTo(5);
    }
}
