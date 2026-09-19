package com.elearning.learning.dto;

import com.elearning.learning.entity.Quiz;
import java.util.List;

public record QuizResponse(
    Long id,
    Long courseId,
    Long lessonId,
    String title,
    String description,
    Integer passingScore,
    Integer timeLimitMinutes,
    List<QuizQuestionResponse> questions
) {
    public static QuizResponse from(Quiz quiz) {
        return new QuizResponse(
            quiz.getId(),
            quiz.getCourseId(),
            quiz.getLessonId(),
            quiz.getTitle(),
            quiz.getDescription(),
            quiz.getPassingScore(),
            quiz.getTimeLimitMinutes(),
            quiz.getQuestions().stream().map(QuizQuestionResponse::from).toList()
        );
    }
}
