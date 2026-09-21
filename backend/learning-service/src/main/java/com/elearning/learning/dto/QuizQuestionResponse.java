package com.elearning.learning.dto;

import com.elearning.learning.entity.QuizQuestion;
import com.elearning.learning.entity.enums.QuestionType;
import java.util.List;

public record QuizQuestionResponse(
    Long id,
    String questionText,
    QuestionType questionType,
    Integer points,
    Integer position,
    List<QuizOptionResponse> options
) {
    public static QuizQuestionResponse from(QuizQuestion question) {
        return new QuizQuestionResponse(
            question.getId(),
            question.getQuestionText(),
            question.getQuestionType(),
            question.getPoints(),
            question.getPosition(),
            question.getOptions().stream().map(QuizOptionResponse::from).toList()
        );
    }
}
