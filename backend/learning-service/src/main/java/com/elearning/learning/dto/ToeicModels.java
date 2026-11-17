package com.elearning.learning.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class ToeicModels {

    private ToeicModels() {}

    public record Lesson(String id, String title, String content) {}

    public record Option(String id, String text) {}

    public record Question(
        String id,
        Integer number,
        Integer part,
        String passage,
        String prompt,
        String imageUrl,
        List<String> passageImageUrls,
        List<Option> options,
        String correctOptionId,
        String explanation,
        String source
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Definition(
        String slug,
        String title,
        String description,
        Integer durationMinutes,
        String sourceLabel,
        List<Lesson> lessons,
        List<Question> questions,
        Boolean published,
        Long version,
        String seedKey
    ) {}

    public record Summary(
        Long id,
        String slug,
        String title,
        String description,
        int durationMinutes,
        int questionCount,
        int lessonCount,
        String sourceLabel,
        long version,
        boolean published
    ) {}

    public record AdminDetail(
        Long id,
        String slug,
        String title,
        String description,
        int durationMinutes,
        String sourceLabel,
        List<Lesson> lessons,
        List<Question> questions,
        boolean published,
        long version
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record QuestionView(
        String id,
        Integer number,
        Integer part,
        String passage,
        String prompt,
        String imageUrl,
        List<String> passageImageUrls,
        List<Option> options,
        String correctOptionId,
        String explanation,
        String source
    ) {}

    public record Detail(
        Long id,
        String slug,
        String title,
        String description,
        int durationMinutes,
        String sourceLabel,
        List<Lesson> lessons,
        List<QuestionView> questions,
        long version
    ) {}

    public record StartRequest(String mode, Integer part) {}

    public record AnswersRequest(Map<String, String> answers) {}

    public record PublishRequest(Boolean published) {}

    public record AttemptView(
        Long id,
        Long examId,
        String title,
        String mode,
        Integer part,
        String status,
        Instant startedAt,
        Instant deadlineAt,
        Instant submittedAt,
        Instant serverNow,
        Integer score,
        Integer correctCount,
        int totalQuestions,
        Map<String, String> answers,
        List<QuestionView> questions
    ) {}

    public record AttemptSummary(
        Long id,
        String mode,
        Integer part,
        String status,
        Integer score,
        Integer correctCount,
        int totalQuestions,
        Instant startedAt,
        Instant submittedAt,
        Instant deadlineAt
    ) {}

    public record Progress(
        List<String> completedLessonIds,
        List<AttemptSummary> attempts,
        Long activeAttemptId
    ) {}
}
