package com.elearning.learning.dto;

import java.time.LocalDate;
import java.util.List;

public final class EngagementModels {

    private EngagementModels() {}

    public record ActivityDay(LocalDate date, int count) {}

    public record Reward(String code, int gems, boolean eligible, boolean claimed) {}

    public record Summary(
        long userId,
        String displayName,
        long totalXp,
        long level,
        long xpInLevel,
        int xpPerLevel,
        int gems,
        int currentStreak,
        int longestStreak,
        boolean activeToday,
        LocalDate today,
        String timeZone,
        String activeFrame,
        String activeBackground,
        int streakFreezes,
        List<LocalDate> frozenDays,
        List<ActivityDay> days,
        List<Reward> rewards
    ) {}

    public record Ranking(
        long rank,
        long userId,
        String displayName,
        long xp,
        long level,
        String activeFrame
    ) {}

    public record FrameRequest(
        @jakarta.validation.constraints.Pattern(regexp = "[A-Z][A-Z0-9_]{1,31}") String code
    ) {}

    public record Leaderboard(
        String period,
        String month,
        List<Ranking> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        Ranking me
    ) {}
}
