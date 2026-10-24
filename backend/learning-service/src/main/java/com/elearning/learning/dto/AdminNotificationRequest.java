package com.elearning.learning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record AdminNotificationRequest(
    @NotNull @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9._:-]{0,127}") String eventId,
    @NotNull @Positive Long userId,
    @NotBlank @Size(max = 255) String title,
    @NotBlank @Size(max = 1000) String body
) {}
