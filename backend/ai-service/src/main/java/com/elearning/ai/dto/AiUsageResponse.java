package com.elearning.ai.dto;

import java.time.Instant;

public record AiUsageResponse(
    boolean proActive,
    int dailyLimit,
    int used,
    int remaining,
    int proDailyLimit,
    Instant resetsAt
) {}
