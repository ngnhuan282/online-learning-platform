package com.elearning.course.dto;

import com.elearning.course.entity.LessonResource;
import com.elearning.course.entity.ResourceType;
import java.time.Instant;

public record LessonResourceResponse(
    Long id,
    Long lessonId,
    ResourceType resourceType,
    String title,
    String fileName,
    long fileSize,
    String contentType,
    String objectKey,
    String downloadUrl,
    Instant createdAt
) {
    public static LessonResourceResponse from(LessonResource resource) {
        return new LessonResourceResponse(
            resource.getId(),
            resource.getLesson().getId(),
            resource.getResourceType(),
            resource.getTitle(),
            resource.getFileName(),
            resource.getFileSize(),
            resource.getContentType(),
            resource.getObjectKey(),
            resource.getDownloadUrl(),
            resource.getCreatedAt()
        );
    }
}
