package com.elearning.ai.dto;

import com.elearning.ai.entity.AiConversation;
import java.time.Instant;

public record ConversationResponse(
    Long id,
    String title,
    Long courseId,
    Long lessonId,
    String contextTitle,
    Instant createdAt,
    Instant updatedAt
) {
    public static ConversationResponse from(AiConversation conversation) {
        return new ConversationResponse(
            conversation.getId(),
            conversation.getTitle(),
            conversation.getCourseId(),
            conversation.getLessonId(),
            conversation.getContextTitle(),
            conversation.getCreatedAt(),
            conversation.getUpdatedAt()
        );
    }
}
