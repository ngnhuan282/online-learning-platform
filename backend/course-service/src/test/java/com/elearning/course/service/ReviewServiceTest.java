package com.elearning.course.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
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
    private CourseContentAccess access;

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
    void create_whenEligibleLearnerSubmitsReview_shouldRecalculateRating() {
        // Arrange
        Long courseId = 10L;
        Long userId = 42L;
        ReviewRequest request = new ReviewRequest(5, "Tuyệt vời!");

        when(reviewRepository.existsByCourseIdAndUserId(courseId, userId)).thenReturn(false);
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(sampleCourse));
        when(access.canReadPrivate(sampleCourse)).thenReturn(true);
        when(reviewRepository.avgRatingByCourseId(courseId)).thenReturn(5.0);
        when(reviewRepository.countByCourseId(courseId)).thenReturn(1);

        // Act
        ReviewResponse response = reviewService.create(courseId, userId, request);

        // Assert
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
    void create_whenCallerIsNotEnrolled_shouldThrowForbidden() {
        // Arrange
        Long courseId = 10L;
        Long userId = 42L;
        ReviewRequest request = new ReviewRequest(5, "Tuyệt vời!");

        when(courseRepository.findById(courseId)).thenReturn(Optional.of(sampleCourse));
        when(access.canReadPrivate(sampleCourse)).thenReturn(false);

        // Act
        var thrown = catchThrowable(() -> reviewService.create(courseId, userId, request));

        // Assert
        assertThat(thrown)
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
    }

    @Test
    void create_whenReviewAlreadyExists_shouldThrowConflict() {
        // Arrange
        Long courseId = 10L;
        Long userId = 42L;
        ReviewRequest request = new ReviewRequest(4, "Khóa học hay");

        when(reviewRepository.existsByCourseIdAndUserId(courseId, userId)).thenReturn(true);
        when(courseRepository.findById(courseId)).thenReturn(Optional.of(sampleCourse));
        when(access.canReadPrivate(sampleCourse)).thenReturn(true);

        // Act
        var thrown = catchThrowable(() -> reviewService.create(courseId, userId, request));

        // Assert
        assertThat(thrown)
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONFLICT);

        verify(reviewRepository, never()).save(any());
    }

    @Test
    void create_whenCourseDoesNotExist_shouldThrowNotFound() {
        // Arrange
        Long courseId = 999L;
        Long userId = 42L;
        ReviewRequest request = new ReviewRequest(4, "Good");

        when(courseRepository.findById(courseId)).thenReturn(Optional.empty());

        // Act
        var thrown = catchThrowable(() -> reviewService.create(courseId, userId, request));

        // Assert
        assertThat(thrown)
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    void update_whenOwnerEditsReview_shouldRecalculateRating() {
        // Arrange
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

        // Act
        ReviewResponse response = reviewService.update(courseId, reviewId, userId, request);

        // Assert
        assertThat(response.rating()).isEqualTo(4);
        assertThat(response.comment()).isEqualTo("Nội dung cập nhật");
        verify(reviewRepository).save(existing);
        verify(courseRepository).save(sampleCourse);
    }

    @Test
    void update_whenCallerDoesNotOwnReview_shouldThrowForbidden() {
        // Arrange
        Long courseId = 10L;
        Long reviewId = 100L;
        Long otherUserId = 99L;
        ReviewRequest request = new ReviewRequest(4, "Hacked comment");

        Review existing = new Review();
        existing.setId(reviewId);
        existing.setCourse(sampleCourse);
        existing.setUserId(42L); // Owner is 42

        when(reviewRepository.findById(reviewId)).thenReturn(Optional.of(existing));

        // Act
        var thrown = catchThrowable(() -> reviewService.update(courseId, reviewId, otherUserId, request));

        // Assert
        assertThat(thrown)
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
    }

    @Test
    void delete_whenReviewIsRemoved_shouldRecalculateRating() {
        // Arrange
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

        // Act
        reviewService.delete(courseId, reviewId, userId);

        // Assert
        verify(reviewRepository).delete(existing);
        verify(courseRepository).save(sampleCourse);
        assertThat(sampleCourse.getAvgRating()).isEqualTo(0.0);
        assertThat(sampleCourse.getReviewCount()).isEqualTo(0);
    }

    @Test
    void setVisibility_whenAdministratorHidesAndShowsReview_shouldUpdatePublicVisibility() {
        // Arrange
        Long courseId = 10L;
        Long reviewId = 100L;

        Review existing = new Review();
        existing.setId(reviewId);
        existing.setCourse(sampleCourse);
        existing.setHidden(false);

        when(reviewRepository.findById(reviewId)).thenReturn(Optional.of(existing));
        when(reviewRepository.avgRatingByCourseId(courseId)).thenReturn(4.5);
        when(reviewRepository.countByCourseId(courseId)).thenReturn(2);

        ReviewResponse hiddenRes = reviewService.hide(courseId, reviewId);
        // Act
        assertThat(hiddenRes.hidden()).isTrue();
        assertThat(existing.isHidden()).isTrue();
        verify(courseRepository, times(1)).save(sampleCourse);

        ReviewResponse shownRes = reviewService.show(courseId, reviewId);
        // Assert
        assertThat(shownRes.hidden()).isFalse();
        assertThat(existing.isHidden()).isFalse();
        verify(courseRepository, times(2)).save(sampleCourse);
    }

    @Test
    void setVisibility_whenReviewExists_shouldChangeVisibility() {
        // Arrange
        Long reviewId = 100L;
        Review existing = new Review();
        existing.setId(reviewId);
        existing.setCourse(sampleCourse);
        existing.setHidden(false);

        when(reviewRepository.findById(reviewId)).thenReturn(Optional.of(existing));
        when(reviewRepository.avgRatingByCourseId(sampleCourse.getId())).thenReturn(4.0);
        when(reviewRepository.countByCourseId(sampleCourse.getId())).thenReturn(1);

        // Act
        ReviewResponse res = reviewService.setVisibility(reviewId, true);
        assertThat(res.hidden()).isTrue();
        assertThat(existing.isHidden()).isTrue();

        ReviewResponse res2 = reviewService.setVisibility(reviewId, false);
        // Assert
        assertThat(res2.hidden()).isFalse();
        assertThat(existing.isHidden()).isFalse();
    }

    @Test
    void listAll_whenNoCourseFilterIsSpecified_shouldIncludeReviewsAcrossCourses() {
        // Arrange
        Review rev = new Review();
        rev.setId(1L);
        rev.setCourse(sampleCourse);
        rev.setUserId(42L);
        rev.setRating(5);
        rev.setHidden(false);

        when(reviewRepository.findAll(any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(rev)));

        // Act
        Page<ReviewResponse> page = reviewService.listAll(0, 10);
        // Assert
        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).courseTitle()).isEqualTo("Spring Boot Masterclass");
    }

    @Test
    void listPublic_whenSomeReviewsAreHidden_shouldReturnVisibleReviews() {
        // Arrange
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

        // Act
        Page<ReviewResponse> page = reviewService.listPublic(courseId, 0, 10);
        // Assert
        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).rating()).isEqualTo(5);
    }
}
