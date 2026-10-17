package com.elearning.ai.dto;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateConversationRequest(
    @Size(max = 100) String title,
    @Positive Long courseId,
    @Positive Long lessonId
) {}
