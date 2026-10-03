package com.elearning.course.dto;

import com.elearning.course.entity.Section;
import java.time.Instant;
import java.util.List;

public record SectionResponse(
    Long id,
    Long courseId,
    String title,
    int orderIndex,
    List<LessonResponse> lessons,
    Instant createdAt,
    Instant updatedAt
) {
    public static SectionResponse from(Section section) {
        List<LessonResponse> lessons = section.getLessons().stream()
            .map(LessonResponse::from)
            .toList();

        return new SectionResponse(
            section.getId(),
            section.getCourse().getId(),
            section.getTitle(),
            section.getOrderIndex(),
            lessons,
            section.getCreatedAt(),
            section.getUpdatedAt()
        );
    }
}
