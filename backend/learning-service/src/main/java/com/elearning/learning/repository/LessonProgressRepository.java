package com.elearning.learning.repository;

import com.elearning.learning.entity.LessonProgress;
import com.elearning.learning.entity.enums.ProgressStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonProgressRepository extends JpaRepository<LessonProgress, Long> {
    List<LessonProgress> findByUserIdAndCourseIdOrderByUpdatedAtDesc(Long userId, Long courseId);

    List<LessonProgress> findByUserIdAndCourseIdOrderByLessonIdAsc(Long userId, Long courseId);

    Optional<LessonProgress> findByUserIdAndCourseIdAndLessonId(
        Long userId,
        Long courseId,
        Long lessonId
    );

    Optional<LessonProgress> findByUserIdAndLessonId(Long userId, Long lessonId);

    long countByUserIdAndStatus(Long userId, ProgressStatus status);
}
