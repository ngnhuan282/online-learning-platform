package com.elearning.learning.dto;

public record EnrollmentCheckResponse(
    boolean enrolled,
    String status,
    Long userId,
    Long courseId
) {}
