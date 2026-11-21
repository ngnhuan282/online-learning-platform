package com.elearning.course.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.CourseRequest;
import com.elearning.course.dto.CourseResponse;
import com.elearning.course.entity.Category;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseLevel;
import com.elearning.course.entity.CourseStatus;
import com.elearning.course.repository.CategoryRepository;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.security.CourseContentAccess;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CourseServiceTest {

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private CourseContentAccess access;

    @InjectMocks
    private CourseService courseService;

    private Category category;
    private Course course;

    @BeforeEach
    void setUp() {
        category = new Category();
        category.setId(1L);
        category.setName("Java Programming");
        category.setSlug("java-programming");

        course = new Course();
        course.setId(10L);
        course.setTitle("Spring Boot Core");
        course.setSlug("spring-boot-core");
        course.setDescription("Comprehensive Spring Boot Guide");
        course.setCategory(category);
        course.setPrice(BigDecimal.valueOf(200000));
        course.setLevel(CourseLevel.BEGINNER);
        course.setStatus(CourseStatus.PUBLISHED);
        course.setCreatedAt(Instant.now());
        course.setUpdatedAt(Instant.now());
    }

    @Test
    void create_whenCategoryIsMissing_shouldThrowNotFound() {
        // Arrange
        CourseRequest req = new CourseRequest(
            "New Course",
            "Description",
            99L,
            BigDecimal.valueOf(100000),
            BigDecimal.valueOf(200000),
            CourseLevel.BEGINNER,
            CourseStatus.DRAFT,
            null
        );

        when(categoryRepository.findById(99L)).thenReturn(Optional.empty());

        // Act
        var thrown = catchThrowable(() -> courseService.create(req));

        // Assert
        assertThat(thrown)
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);

        verify(courseRepository, never()).save(any());
    }

    @Test
    void create_whenSlugBelongsToAnotherCourse_shouldThrowConflict() {
        // Arrange
        CourseRequest req = new CourseRequest(
            "Spring Boot Core",
            "Description",
            1L,
            BigDecimal.valueOf(100000),
            null,
            CourseLevel.BEGINNER,
            CourseStatus.DRAFT,
            null
        );

        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category));
        when(courseRepository.existsBySlug("spring-boot-core")).thenReturn(true);

        // Act
        var thrown = catchThrowable(() -> courseService.create(req));

        // Assert
        assertThat(thrown)
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONFLICT);
    }

    @Test
    void create_whenRequestIsValid_shouldPersistAndReturnCourse() {
        // Arrange
        CourseRequest req = new CourseRequest(
            "Spring Boot Advanced",
            "Advanced course description",
            1L,
            BigDecimal.valueOf(300000),
            BigDecimal.valueOf(500000),
            CourseLevel.ADVANCED,
            CourseStatus.PUBLISHED,
            "https://img.com/thumb.jpg"
        );

        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category));
        when(courseRepository.existsBySlug("spring-boot-advanced")).thenReturn(false);
        when(courseRepository.save(any(Course.class))).thenAnswer(invocation -> {
            Course c = invocation.getArgument(0);
            c.setId(11L);
            c.setCreatedAt(Instant.now());
            c.setUpdatedAt(Instant.now());
            return c;
        });

        // Act
        CourseResponse resp = courseService.create(req);

        // Assert
        assertThat(resp).isNotNull();
        assertThat(resp.id()).isEqualTo(11L);
        assertThat(resp.title()).isEqualTo("Spring Boot Advanced");
        assertThat(resp.slug()).isEqualTo("spring-boot-advanced");
        assertThat(resp.categoryId()).isEqualTo(1L);
    }

    @Test
    void update_whenCourseDoesNotExist_shouldThrowNotFound() {
        // Arrange
        CourseRequest req = new CourseRequest("Title", "Desc", 1L, BigDecimal.ZERO, null, null, null, null);
        when(courseRepository.findById(999L)).thenReturn(Optional.empty());

        // Act
        var thrown = catchThrowable(() -> courseService.update(999L, req));

        // Assert
        assertThat(thrown)
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    void update_whenCourseExists_shouldPersistChangedFields() {
        // Arrange
        CourseRequest req = new CourseRequest(
            "Spring Boot Core Updated",
            "Updated Desc",
            1L,
            BigDecimal.valueOf(250000),
            null,
            CourseLevel.INTERMEDIATE,
            CourseStatus.PUBLISHED,
            null
        );

        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category));
        when(courseRepository.existsBySlug("spring-boot-core-updated")).thenReturn(false);
        when(courseRepository.save(any(Course.class))).thenAnswer(i -> i.getArgument(0));

        // Act
        CourseResponse resp = courseService.update(10L, req);

        // Assert
        assertThat(resp.title()).isEqualTo("Spring Boot Core Updated");
        assertThat(resp.slug()).isEqualTo("spring-boot-core-updated");
        assertThat(resp.price()).isEqualByComparingTo(BigDecimal.valueOf(250000));
    }

    @Test
    void delete_whenCourseDoesNotExist_shouldThrowNotFound() {
        // Arrange
        when(courseRepository.findById(999L)).thenReturn(Optional.empty());

        // Act
        var thrown = catchThrowable(() -> courseService.delete(999L));

        // Assert
        assertThat(thrown)
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    void delete_whenCourseExists_shouldArchiveCourse() {
        // Arrange
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));

        // Act
        courseService.delete(10L);

        // Assert
        assertThat(course.getStatus()).isEqualTo(CourseStatus.ARCHIVED);
        org.mockito.Mockito.verify(courseRepository, org.mockito.Mockito.never()).delete(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void get_whenCourseExists_shouldReturnCourse() {
        // Arrange
        when(courseRepository.findById(10L)).thenReturn(Optional.of(course));

        // Act
        CourseResponse resp = courseService.get(10L);

        // Assert
        assertThat(resp).isNotNull();
        assertThat(resp.id()).isEqualTo(10L);
        assertThat(resp.title()).isEqualTo("Spring Boot Core");
    }

    @Test
    void get_whenCourseDoesNotExist_shouldThrowNotFound() {
        // Arrange
        when(courseRepository.findById(404L)).thenReturn(Optional.empty());

        // Act
        var thrown = catchThrowable(() -> courseService.get(404L));

        // Assert
        assertThat(thrown)
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }
}
