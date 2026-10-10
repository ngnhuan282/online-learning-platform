package com.elearning.learning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record PaymentEnrollmentRequest(
    @NotBlank @Size(max = 40) String orderCode,
    @NotNull @Positive Long userId,
    @NotNull @Positive Long courseId
) {}
