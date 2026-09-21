package com.elearning.learning.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record EnrollRequest(@NotNull @Positive Long courseId) {}
