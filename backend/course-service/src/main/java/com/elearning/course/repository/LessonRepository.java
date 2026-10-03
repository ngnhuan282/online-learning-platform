package com.elearning.course.repository;

import com.elearning.course.entity.Lesson;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonRepository extends JpaRepository<Lesson, Long> {

    List<Lesson> findBySectionIdOrderByOrderIndexAsc(Long sectionId);
}
