package com.elearning.learning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class CommunityModels {

    private CommunityModels() {}

    public record Topic(long id, String code) {}

    public record PostRequest(
        @NotNull @Positive Long topicId,
        @NotBlank @Pattern(regexp = "DISCUSSION|QUESTION") String kind,
        @NotBlank @Size(max = 160) String title,
        @NotBlank @Size(max = 12000) String body
    ) {}

    public record CommentRequest(@NotBlank @Size(max = 4000) String body) {}

    public record AnswerRequest(@Positive Long commentId) {}

    public record LockRequest(@NotNull Boolean locked) {}

    public record Post(
        long id,
        long authorId,
        String authorName,
        long topicId,
        String topicCode,
        String kind,
        String title,
        String body,
        boolean locked,
        Long acceptedCommentId,
        long commentCount,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record Comment(
        long id,
        long postId,
        long authorId,
        String authorName,
        String body,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
