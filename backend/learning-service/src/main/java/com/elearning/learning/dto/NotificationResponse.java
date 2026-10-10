package com.elearning.learning.dto;

import com.elearning.learning.entity.Notification;
import com.elearning.learning.entity.enums.NotificationType;
import com.elearning.learning.entity.enums.NotificationCategory;
import java.time.Instant;

public record NotificationResponse(
    Long id,
    NotificationType type,
    String title,
    String body,
    String actionUrl,
    boolean read,
    Instant readAt,
    Instant createdAt,
    NotificationCategory category
) {
    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
            notification.getId(),
            notification.getType(),
            notification.getTitle(),
            notification.getBody(),
            notification.getActionUrl(),
            notification.getReadAt() != null,
            notification.getReadAt(),
            notification.getCreatedAt(),
            notification.getType().category()
        );
    }
}
