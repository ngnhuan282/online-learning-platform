package com.elearning.learning.repository;

import com.elearning.learning.entity.LessonProgress;
import com.elearning.learning.entity.enums.ProgressStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonProgressRepository extends JpaRepository<LessonProgress, Long> {
    List<LessonProgress> findByUserIdAndCourseIdOrderByUpdatedAtDesc(Long userId, Long courseId);

    long countByUserIdAndStatus(Long userId, ProgressStatus status);
}
