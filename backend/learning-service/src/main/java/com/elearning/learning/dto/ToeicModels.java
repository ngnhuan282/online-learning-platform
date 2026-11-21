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

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Listening(String audioUrl, String transcript) {}

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
        String source,
        Listening listening
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
        boolean published,
        String section
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
        String source,
        Listening listening
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
        long version,
        Long companionExamId
    ) {}

    public record StartRequest(String mode, Integer part, Integer durationMinutes) {}

    public record AnswersRequest(Map<String, String> answers) {}

    public record PublishRequest(Boolean published) {}

    public record AttemptView(
        Long id,
        Long examId,
        String title,
        String mode,
        Integer part,
        Integer durationMinutes,
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
        Integer durationMinutes,
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

    public record NoteItem(
        Long id,
        Long examId,
        Long attemptId,
        Integer questionNumber,
        Integer part,
        String examTitle,
        String selectedText,
        String noteContent,
        String color,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record NotesCollection(List<NoteItem> items, int count, Integer limit, boolean isPro) {}

    public record NoteMutationResult(NoteItem note, int count, Integer limit, boolean isPro) {}

    public record CreateNoteRequest(
        Long examId,
        Long attemptId,
        Integer questionNumber,
        Integer part,
        String selectedText,
        String noteContent,
        String color
    ) {}

    public record UpdateNoteRequest(String noteContent, String color) {}

    public record DictionaryMeaning(
        String partOfSpeech,
        String meaningVi,
        String exampleEn,
        String exampleVi
    ) {}

    public record DictionaryEntry(
        String term,
        String headword,
        String phonetic,
        List<DictionaryMeaning> meanings,
        List<String> relatedForms,
        boolean found
    ) {}
}
