package com.elearning.ai.dto;

import com.elearning.ai.entity.AiMessage;
import java.time.Instant;

public record MessageResponse(
    Long id,
    String sender,
    String content,
    String requestId,
    Instant createdAt,
    boolean truncated
) {
    public static MessageResponse from(AiMessage message) {
        return new MessageResponse(
            message.getId(),
            message.getSender(),
            message.getContent(),
            message.getRequestId(),
            message.getCreatedAt(),
            message.isTruncated()
        );
    }
}
