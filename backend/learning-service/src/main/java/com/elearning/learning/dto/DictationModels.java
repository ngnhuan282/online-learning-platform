package com.elearning.learning.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public final class DictationModels {

    private DictationModels() {}

    public record Sentence(@NotBlank @Size(max = 1500) String text, Double start, Double end) {}

    public record Video(@NotBlank @Size(max = 2048) String url, Double duration) {}

    @JsonIgnoreProperties("toeicTest")
    public record Definition(
        @NotBlank @Size(max = 180) String title,
        @Size(max = 1500) String description,
        @NotBlank @Size(max = 60) String topic,
        @Pattern(regexp = "A1|A2|B1|B2|C1|C2") @NotNull String level,
        @Size(max = 80) String audioKey,
        @NotNull @Size(min = 1, max = 200) List<@NotNull @Valid Sentence> sentences,
        @Valid Video video
    ) {
        public Definition(
            String title,
            String description,
            String topic,
            String level,
            String audioKey,
            List<Sentence> sentences
        ) {
            this(title, description, topic, level, audioKey, sentences, null);
        }
    }

    public record SaveRequest(@NotNull @Valid Definition definition, @Min(0) int version) {}

    public record VersionRequest(@Min(1) int version) {}

    public record PublishRequest(@Min(1) int version, @Valid Definition definition) {}

    public record VisibilityRequest(boolean archived) {}

    public record StartRequest(
        @NotBlank @Pattern(regexp = "[a-zA-Z0-9-]{1,80}") String requestId,
        boolean restart
    ) {}

    public record AnswerRequest(@Min(0) int index, @NotNull @Size(max = 2000) String text) {}

    public record IndexRequest(@Min(0) int index) {}

    public record HintRequest(@Min(0) int index, @Min(0) int wordIndex) {}

    public record Hint(int index, String text) {}

    public record Feedback(int index, String state, String text) {}

    public record Audio(String key, double duration, String name) {}

    public record Edit(String type, String expected, String actual) {}

    public record Grade(int correct, int total, int extra, double accuracy, List<Edit> words) {}

    public record Response(
        int index,
        String text,
        boolean checked,
        boolean revealed,
        boolean skipped,
        Double firstAccuracy,
        Grade grade,
        String answer,
        List<Hint> hints,
        boolean completed,
        List<Feedback> feedback
    ) {}

    public record Segment(int index, double start, double end, int words, List<Integer> wordLengths) {}

    public record Attempt(
        String id,
        String exerciseId,
        int version,
        String title,
        String topic,
        String level,
        double duration,
        int currentIndex,
        List<Segment> sentences,
        List<Response> responses,
        int completed,
        double accuracy,
        Instant startedAt,
        Instant completedAt,
        String scoringMode,
        boolean archived,
        Video video
    ) {}

    public record Item(
        String id,
        String title,
        String description,
        String topic,
        String level,
        double duration,
        int sentenceCount,
        String status,
        boolean hasDraft,
        int version,
        String attemptId,
        int completed,
        int progressTotal,
        boolean attemptCompleted,
        Double accuracy,
        boolean video,
        String thumbnailUrl
    ) {}

    public record Catalog(List<Item> items, long total, int page, int size, List<String> topics) {}

    public record TopicGroup(String topic, long total, List<Item> items) {}

    public record GroupedCatalog(List<TopicGroup> groups) {}

    public record History(List<Attempt> items, long total, int page, int size, List<String> topics) {}

    public record AdminDetail(
        String id,
        int version,
        boolean archived,
        boolean published,
        boolean hasDraft,
        Definition definition,
        Audio audio
    ) {}

    public record ImportIssue(int row, String message) {}

    public record ImportResult(List<Sentence> sentences, List<ImportIssue> errors) {}
}
