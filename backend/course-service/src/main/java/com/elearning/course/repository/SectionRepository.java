package com.elearning.course.repository;

import com.elearning.course.entity.Section;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SectionRepository extends JpaRepository<Section, Long> {

    List<Section> findByCourseIdOrderByOrderIndexAsc(Long courseId);

    boolean existsByCourseId(Long courseId);
}
