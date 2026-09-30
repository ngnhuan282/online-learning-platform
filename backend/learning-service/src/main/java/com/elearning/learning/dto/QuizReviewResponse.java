package com.elearning.learning.dto;

import com.elearning.learning.entity.Quiz;
import com.elearning.learning.entity.QuizAnswer;
import com.elearning.learning.entity.QuizAttempt;
import com.elearning.learning.entity.QuizOption;
import com.elearning.learning.entity.QuizQuestion;
import com.elearning.learning.entity.enums.QuestionType;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public record QuizReviewResponse(
    Long attemptId,
    Long quizId,
    Long courseId,
    String quizTitle,
    Integer score,
    Boolean passed,
    Integer passingScore,
    Instant startedAt,
    Instant submittedAt,
    List<Question> questions
) {
    public static QuizReviewResponse from(QuizAttempt attempt, Quiz quiz) {
        Map<Long, List<QuizAnswer>> answersByQuestion = attempt.getAnswers().stream()
            .collect(Collectors.groupingBy(answer -> answer.getQuestion().getId()));
        List<Question> questions = quiz.getQuestions().stream()
            .map(question -> Question.from(
                question,
                answersByQuestion.getOrDefault(question.getId(), List.of())
            ))
            .toList();

        return new QuizReviewResponse(
            attempt.getId(),
            quiz.getId(),
            attempt.getCourseId(),
            quiz.getTitle(),
            attempt.getScore(),
            attempt.getPassed(),
            quiz.getPassingScore(),
            attempt.getStartedAt(),
            attempt.getSubmittedAt(),
            questions
        );
    }

    public record Question(
        Long id,
        String questionText,
        QuestionType questionType,
        Integer position,
        Integer points,
        Integer pointsAwarded,
        boolean answered,
        boolean correct,
        List<Option> options
    ) {
        private static Question from(QuizQuestion question, List<QuizAnswer> answers) {
            Set<Long> selectedIds = answers.stream()
                .filter(answer -> answer.getSelectedOption() != null)
                .map(answer -> answer.getSelectedOption().getId())
                .collect(Collectors.toSet());
            int pointsAwarded = answers.stream()
                .mapToInt(answer -> answer.getPointsAwarded() == null ? 0 : answer.getPointsAwarded())
                .sum();
            boolean correct = !answers.isEmpty()
                && answers.stream().allMatch(answer -> Boolean.TRUE.equals(answer.getCorrect()));
            List<Option> options = question.getOptions().stream()
                .map(option -> Option.from(option, selectedIds.contains(option.getId())))
                .toList();
            return new Question(
                question.getId(), question.getQuestionText(), question.getQuestionType(),
                question.getPosition(), question.getPoints(), pointsAwarded,
                !selectedIds.isEmpty(), correct, options
            );
        }
    }

    public record Option(Long id, String optionText, Integer position, boolean selected, boolean correct) {
        private static Option from(QuizOption option, boolean selected) {
            return new Option(
                option.getId(), option.getOptionText(), option.getPosition(), selected, option.getCorrect()
            );
        }
    }
}
