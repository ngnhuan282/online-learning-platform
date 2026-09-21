package com.elearning.learning.dto;

import com.elearning.learning.entity.LessonProgress;
import com.elearning.learning.entity.enums.ProgressStatus;
import java.time.Instant;

public record LessonProgressResponse(
    Long id,
    Long courseId,
    Long lessonId,
    ProgressStatus status,
    Integer progressPercent,
    Long timeSpentSeconds,
    Instant firstAccessedAt,
    Instant completedAt,
    Instant updatedAt
) {
    public static LessonProgressResponse from(LessonProgress progress) {
        return new LessonProgressResponse(
            progress.getId(),
            progress.getCourseId(),
            progress.getLessonId(),
            progress.getStatus(),
            progress.getProgressPercent(),
            progress.getTimeSpentSeconds(),
            progress.getFirstAccessedAt(),
            progress.getCompletedAt(),
            progress.getUpdatedAt()
        );
    }
}
