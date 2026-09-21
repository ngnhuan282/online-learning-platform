package com.elearning.course.dto;

import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseLevel;
import com.elearning.course.entity.CourseStatus;
import java.math.BigDecimal;
import java.time.Instant;

public record CourseResponse(
    Long id,
    String title,
    String slug,
    String description,
    Long categoryId,
    String categoryName,
    BigDecimal price,
    BigDecimal originalPrice,
    CourseLevel level,
    CourseStatus status,
    String thumbnailUrl,
    Instant createdAt,
    Instant updatedAt
) {
    public static CourseResponse from(Course course) {
        return new CourseResponse(
            course.getId(),
            course.getTitle(),
            course.getSlug(),
            course.getDescription(),
            course.getCategory().getId(),
            course.getCategory().getName(),
            course.getPrice(),
            course.getOriginalPrice(),
            course.getLevel(),
            course.getStatus(),
            course.getThumbnailUrl(),
            course.getCreatedAt(),
            course.getUpdatedAt()
        );
    }
}
