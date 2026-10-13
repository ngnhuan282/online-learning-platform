package com.elearning.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.elearning.course.dto.CourseResponse;
import com.elearning.course.entity.Category;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseLevel;
import com.elearning.course.entity.CourseStatus;
import com.elearning.course.repository.CategoryRepository;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.service.CourseService;
import com.elearning.course.security.CourseContentAccess;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class CourseCatalogServiceTest {

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private CourseContentAccess access;

    @InjectMocks
    private CourseService courseService;

    @Test
    void shouldFilterPublishedCoursesByKeywordCategoryLevelAndSort() {
        Category category = new Category();
        category.setId(7L);
        category.setName("IELTS");
        category.setSlug("ielts");

        Course beginnerCourse = new Course();
        beginnerCourse.setId(1L);
        beginnerCourse.setTitle("IELTS Writing Intensive");
        beginnerCourse.setSlug("ielts-writing-intensive");
        beginnerCourse.setDescription("Improve your writing accuracy and vocabulary.");
        beginnerCourse.setCategory(category);
        beginnerCourse.setPrice(BigDecimal.valueOf(199000));
        beginnerCourse.setOriginalPrice(BigDecimal.valueOf(299000));
        beginnerCourse.setLevel(CourseLevel.BEGINNER);
        beginnerCourse.setStatus(CourseStatus.PUBLISHED);
        beginnerCourse.setCreatedAt(Instant.parse("2026-09-12T10:00:00Z"));

        when(courseRepository.findByStatusAndCategoryIdAndLevel(
            eq(CourseStatus.PUBLISHED),
            eq(7L),
            eq(CourseLevel.BEGINNER),
            any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(beginnerCourse), Pageable.unpaged(), 1));

        Page<CourseResponse> result = courseService.list(
            0,
            10,
            "writing",
            7L,
            CourseLevel.BEGINNER,
            "newest"
        );

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).categoryId()).isEqualTo(7L);
        assertThat(result.getContent().get(0).level()).isEqualTo(CourseLevel.BEGINNER);
    }
}
