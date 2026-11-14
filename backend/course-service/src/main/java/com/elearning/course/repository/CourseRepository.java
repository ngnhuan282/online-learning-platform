package com.elearning.course.repository;

import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseLevel;
import com.elearning.course.entity.CourseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;

public interface CourseRepository extends JpaRepository<Course, Long> {
    @Query("""
        SELECT c FROM Course c JOIN c.category cat
        WHERE c.status = com.elearning.course.entity.CourseStatus.PUBLISHED
          AND (:keyword IS NULL OR LOCATE(:keyword, LOWER(c.title)) > 0
            OR LOCATE(:keyword, LOWER(c.description)) > 0 OR LOCATE(:keyword, LOWER(cat.name)) > 0)
          AND (:categoryId IS NULL OR cat.id = :categoryId)
          AND (:level IS NULL OR c.level = :level)
          AND (:minPrice IS NULL OR c.price >= :minPrice)
          AND (:maxPrice IS NULL OR c.price <= :maxPrice)
          AND (:minRating IS NULL OR c.avgRating >= :minRating)
          AND (:pricing IS NULL OR (:pricing = 'free' AND c.price = 0) OR (:pricing = 'paid' AND c.price > 0))
        """)
    Page<Course> search(@Param("keyword") String keyword, @Param("categoryId") Long categoryId,
        @Param("level") CourseLevel level, @Param("minPrice") BigDecimal minPrice,
        @Param("maxPrice") BigDecimal maxPrice, @Param("minRating") Double minRating,
        @Param("pricing") String pricing, Pageable pageable);

    Page<Course> findByStatus(CourseStatus status, Pageable pageable);
    Page<Course> findByStatusAndCategoryId(CourseStatus status, Long categoryId, Pageable pageable);
    Page<Course> findByStatusAndLevel(CourseStatus status, CourseLevel level, Pageable pageable);
    Page<Course> findByStatusAndCategoryIdAndLevel(
        CourseStatus status,
        Long categoryId,
        CourseLevel level,
        Pageable pageable
    );
    boolean existsBySlug(String slug);
    boolean existsByThumbnailUrlAndStatus(String thumbnailUrl, CourseStatus status);
    boolean existsByThumbnailUrlStartingWithAndStatus(String thumbnailUrl, CourseStatus status);
}
