package com.elearning.learning.dto;

import jakarta.validation.constraints.*;

public final class LearningAdminModels {

    private LearningAdminModels() {}

    public record DeleteRequest(@Min(0) long version, @NotBlank @Size(max = 400) String reason) {}

    public record RewardDefinitionRequest(
        @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,31}") String code,
        @NotBlank @Size(max = 120) String label,
        @NotBlank @Pattern(regexp = "FIRST_LESSON|STREAK|LEVEL") String metric,
        @Min(1) @Max(10000) int threshold,
        @Min(0) @Max(1000000) int gems,
        boolean active,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {
        @AssertTrue(message = "First-lesson rewards must use threshold one")
        public boolean isThresholdValid() {
            return !"FIRST_LESSON".equals(metric) || threshold == 1;
        }
    }

    public record PostContentRequest(
        @Positive long topicId,
        @NotBlank @Pattern(regexp = "DISCUSSION|QUESTION") String kind,
        @NotBlank @Size(max = 160) String title,
        @NotBlank @Size(max = 20000) String body,
        boolean hidden,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record CommentContentRequest(
        @NotBlank @Size(max = 4000) String body,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record CodeUpdateRequest(
        java.time.Instant expiresAt,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record GrantUpdateRequest(
        @NotBlank @Pattern(regexp = "PRO_[A-Z0-9_]{1,28}") String planCode,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record ItemRequest(
        @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,31}") String code,
        @NotBlank @Size(max = 120) String nameKey,
        @NotBlank @Pattern(regexp = "FRAME|BACKGROUND|FREEZE") String itemType,
        @NotBlank @Pattern(regexp = "RARE|EPIC|LEGENDARY") String rarity,
        @Min(0) @Max(1000000) int price,
        @Min(0) @Max(1000000) Integer originalPrice,
        @NotBlank @Size(max = 64) String assetKey,
        @Min(0) @Max(10000) int position,
        boolean active,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record AdjustmentRequest(
        @NotBlank
        @Pattern(regexp = "[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")
        String requestId,
        @Min(-1000000) @Max(1000000) int gemsDelta,
        @Min(-1000000000) @Max(1000000000) long xpDelta,
        @Min(1) @Max(10000) Integer targetLevel,
        @Min(-7) @Max(7) int freezesDelta,
        @Min(0) @Max(10000) Integer restoredStreak,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record SettingsRequest(
        @Min(1) @Max(100000) int lessonXp,
        @Min(1) @Max(100000) int quizXp,
        @Min(0) @Max(100000) int dailyGems,
        @Min(1) @Max(100000) int xpPerLevel,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record RewardRequest(
        @Min(0) @Max(1000000) int gems,
        boolean active,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record GrantRequest(
        @NotBlank @Pattern(regexp = "PRO_[A-Z0-9_]{1,28}") String planCode,
        @NotBlank
        @Pattern(regexp = "[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}")
        String requestId,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record SuspensionRequest(
        boolean suspended,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record ReasonRequest(@NotBlank @Size(max = 400) String reason) {}

    public record InventoryRequest(boolean owned, @NotBlank @Size(max = 400) String reason) {}

    public record ModerationRequest(
        boolean hidden,
        boolean locked,
        @NotBlank @Size(max = 400) String reason
    ) {}
}
