package com.elearning.learning.dto;

import com.elearning.learning.entity.QuizAttempt;
import com.elearning.learning.entity.enums.AttemptStatus;
import java.time.Instant;

public record QuizResultResponse(
    Long attemptId,
    Long quizId,
    Long courseId,
    AttemptStatus status,
    Integer score,
    Boolean passed,
    Instant startedAt,
    Instant submittedAt
) {
    public static QuizResultResponse from(QuizAttempt attempt) {
        return new QuizResultResponse(
            attempt.getId(),
            attempt.getQuiz().getId(),
            attempt.getCourseId(),
            attempt.getStatus(),
            attempt.getScore(),
            attempt.getPassed(),
            attempt.getStartedAt(),
            attempt.getSubmittedAt()
        );
    }
}
