package com.elearning.course.dto;

import com.elearning.course.entity.Review;
import java.time.Instant;

public record ReviewResponse(
    Long id,
    Long courseId,
    Long userId,
    String userFullName,
    int rating,
    String comment,
    boolean hidden,
    Instant createdAt,
    Instant updatedAt
) {
    public static ReviewResponse from(Review review) {
        return new ReviewResponse(
            review.getId(),
            review.getCourse().getId(),
            review.getUserId(),
            review.getUserFullName(),
            review.getRating(),
            review.getComment(),
            review.isHidden(),
            review.getCreatedAt(),
            review.getUpdatedAt()
        );
    }
}
