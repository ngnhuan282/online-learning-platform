package com.elearning.learning.dto;

import com.elearning.learning.entity.enums.NotificationType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

public record NotificationEventRequest(
    @NotNull @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9._:-]{0,127}") String eventId,
    @NotNull @Positive Long userId,
    @NotNull NotificationType type,
    @Positive Long courseId,
    @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9._-]{0,99}") String orderCode
) {}
