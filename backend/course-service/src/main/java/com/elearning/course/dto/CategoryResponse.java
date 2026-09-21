package com.elearning.course.dto;

import com.elearning.course.entity.Category;
import java.time.Instant;

public record CategoryResponse(Long id, String name, String slug, String description, Instant createdAt) {
    public static CategoryResponse from(Category category) {
        return new CategoryResponse(
            category.getId(),
            category.getName(),
            category.getSlug(),
            category.getDescription(),
            category.getCreatedAt()
        );
    }
}
