package com.elearning.course.dto;

import com.elearning.course.entity.Lesson;
import com.elearning.course.entity.LessonType;
import com.elearning.course.security.MediaTickets;
import java.time.Instant;

public record LessonResponse(
    Long id,
    Long sectionId,
    String title,
    LessonType lessonType,
    String content,
    String videoUrl,
    Integer duration,
    int orderIndex,
    boolean preview,
    Instant createdAt,
    Instant updatedAt
) {
    public static LessonResponse forReader(Lesson lesson, boolean enrolled, MediaTickets tickets) {
        boolean readable = enrolled || lesson.isPreview();
        return new LessonResponse(
            lesson.getId(), lesson.getSection().getId(), lesson.getTitle(), lesson.getLessonType(),
            readable ? lesson.getContent() : null,
            readable ? tickets.signLocalUrl(lesson.getVideoUrl()) : null,
            lesson.getDuration(), lesson.getOrderIndex(), lesson.isPreview(),
            lesson.getCreatedAt(), lesson.getUpdatedAt()
        );
    }

    public static LessonResponse from(Lesson lesson) {
        return new LessonResponse(
            lesson.getId(),
            lesson.getSection().getId(),
            lesson.getTitle(),
            lesson.getLessonType(),
            lesson.getContent(),
            lesson.getVideoUrl(),
            lesson.getDuration(),
            lesson.getOrderIndex(),
            lesson.isPreview(),
            lesson.getCreatedAt(),
            lesson.getUpdatedAt()
        );
    }
}
