package com.elearning.learning.dto;

import com.elearning.learning.entity.Quiz;
import com.elearning.learning.entity.enums.QuestionType;
import java.util.List;

public record AdminQuizResponse(
    Long id,
    Long courseId,
    Long lessonId,
    String title,
    String description,
    Integer passingScore,
    Integer timeLimitMinutes,
    Boolean published,
    List<Question> questions
) {
    public record Question(
        Long id,
        String questionText,
        QuestionType questionType,
        Integer points,
        Integer position,
        List<Option> options
    ) {}

    public record Option(Long id, String optionText, Boolean correct, Integer position) {}

    public static AdminQuizResponse from(Quiz quiz) {
        return new AdminQuizResponse(
            quiz.getId(), quiz.getCourseId(), quiz.getLessonId(), quiz.getTitle(),
            quiz.getDescription(), quiz.getPassingScore(), quiz.getTimeLimitMinutes(),
            quiz.getPublished(), quiz.getQuestions().stream().map(question ->
                new Question(
                    question.getId(), question.getQuestionText(), question.getQuestionType(),
                    question.getPoints(), question.getPosition(), question.getOptions().stream().map(option ->
                        new Option(option.getId(), option.getOptionText(), option.getCorrect(), option.getPosition())
                    ).toList()
                )
            ).toList()
        );
    }
}
