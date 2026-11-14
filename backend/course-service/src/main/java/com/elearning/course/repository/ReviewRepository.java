package com.elearning.course.repository;

import com.elearning.course.entity.Review;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    @EntityGraph(attributePaths = {"course"})
    Page<Review> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"course"})
    Page<Review> findByCourseIdAndHiddenFalse(Long courseId, Pageable pageable);

    @EntityGraph(attributePaths = {"course"})
    Page<Review> findByCourseId(Long courseId, Pageable pageable);

    Optional<Review> findByCourseIdAndUserId(Long courseId, Long userId);

    boolean existsByCourseIdAndUserId(Long courseId, Long userId);

    @Query("SELECT COALESCE(AVG(r.rating), 0) FROM Review r WHERE r.course.id = :courseId AND r.hidden = false")
    double avgRatingByCourseId(@Param("courseId") Long courseId);

    @Query("SELECT COUNT(r) FROM Review r WHERE r.course.id = :courseId AND r.hidden = false")
    int countByCourseId(@Param("courseId") Long courseId);
}
