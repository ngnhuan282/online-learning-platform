package com.elearning.learning.dto;

import com.elearning.learning.entity.enums.ProgressStatus;
import com.elearning.learning.service.CourseCatalogClient.Curriculum;
import com.elearning.learning.service.CourseCatalogClient.SectionReference;
import java.util.List;

public record LearningCourseResponse(
    Long courseId,
    String title,
    int completedLessons,
    int totalLessons,
    int progressPercent,
    List<SectionReference> sections,
    List<LessonProgressResponse> progress
) {
    public static LearningCourseResponse from(Curriculum curriculum, List<LessonProgressResponse> progress) {
        var lessonIds = curriculum.lessonIds();
        int completed = (int) progress
            .stream()
            .filter(item -> lessonIds.contains(item.lessonId()) && item.status() == ProgressStatus.COMPLETED)
            .map(LessonProgressResponse::lessonId)
            .distinct()
            .count();
        int total = lessonIds.size();
        return new LearningCourseResponse(
            curriculum.courseId(),
            curriculum.title(),
            completed,
            total,
            total == 0 ? 0 : (int) Math.round((completed * 100.0) / total),
            curriculum.sections(),
            progress
        );
    }
}
