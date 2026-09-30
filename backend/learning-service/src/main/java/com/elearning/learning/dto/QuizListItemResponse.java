package com.elearning.learning.dto;

import com.elearning.learning.entity.Quiz;

public record QuizListItemResponse(
    Long id,
    Long courseId,
    Long lessonId,
    String title,
    Integer passingScore,
    Integer timeLimitMinutes,
    Boolean published
) {
    public static QuizListItemResponse from(Quiz quiz) {
        return new QuizListItemResponse(
            quiz.getId(), quiz.getCourseId(), quiz.getLessonId(), quiz.getTitle(),
            quiz.getPassingScore(), quiz.getTimeLimitMinutes(), quiz.getPublished()
        );
    }
}
