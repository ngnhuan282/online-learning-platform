package com.elearning.course;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.elearning.course.entity.Category;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseLevel;
import com.elearning.course.entity.CourseStatus;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

public class CourseFoundationTest {

    @Test
    void shouldCreateCourseAndCategoryModels() {
        Category category = new Category();
        category.setName("Java");
        category.setSlug("java");

        Course course = new Course();
        course.setTitle("Spring Boot Fundamentals");
        course.setSlug("spring-boot-fundamentals");
        course.setDescription("Core concepts of Spring Boot");
        course.setCategory(category);
        course.setPrice(BigDecimal.valueOf(199000));
        course.setLevel(CourseLevel.BEGINNER);
        course.setStatus(CourseStatus.PUBLISHED);

        assertNotNull(category.getName());
        assertNotNull(course.getTitle());
        assertNotNull(course.getCategory());
        assertNotNull(course.getStatus());
    }
}
