package com.elearning.course.repository;

import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseRepository extends JpaRepository<Course, Long> {
    Page<Course> findByStatus(CourseStatus status, Pageable pageable);
    boolean existsBySlug(String slug);
}
