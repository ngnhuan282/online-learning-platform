package com.elearning.learning.dto;

import com.elearning.learning.entity.Enrollment;
import com.elearning.learning.entity.enums.EnrollmentStatus;
import java.time.Instant;

public record EnrollmentResponse(
    Long id,
    Long courseId,
    EnrollmentStatus status,
    Instant enrolledAt,
    Instant completedAt,
    Instant lastAccessedAt
) {
    public static EnrollmentResponse from(Enrollment enrollment) {
        return new EnrollmentResponse(
            enrollment.getId(),
            enrollment.getCourseId(),
            enrollment.getStatus(),
            enrollment.getEnrolledAt(),
            enrollment.getCompletedAt(),
            enrollment.getLastAccessedAt()
        );
    }
}
