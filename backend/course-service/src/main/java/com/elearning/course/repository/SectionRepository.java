package com.elearning.course.repository;

import com.elearning.course.entity.Section;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SectionRepository extends JpaRepository<Section, Long> {

    List<Section> findByCourseIdOrderByOrderIndexAsc(Long courseId);

    @Query("SELECT DISTINCT s FROM Section s LEFT JOIN FETCH s.lessons WHERE s.course.id = :courseId ORDER BY s.orderIndex ASC")
    List<Section> findByCourseIdWithLessons(@Param("courseId") Long courseId);

    boolean existsByCourseId(Long courseId);
}
