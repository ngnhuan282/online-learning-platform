package com.elearning.learning.dto;

import com.elearning.learning.entity.Notification;
import com.elearning.learning.entity.enums.NotificationCategory;
import com.elearning.learning.entity.enums.NotificationType;
import java.time.Instant;

public record AdminNotificationResponse(
    Long id,
    Long userId,
    NotificationType type,
    String title,
    String body,
    String actionUrl,
    boolean read,
    Instant readAt,
    Instant createdAt,
    NotificationCategory category
) {
    public static AdminNotificationResponse from(Notification notification) {
        return new AdminNotificationResponse(
            notification.getId(), notification.getUserId(), notification.getType(),
            notification.getTitle(), notification.getBody(), notification.getActionUrl(),
            notification.getReadAt() != null, notification.getReadAt(), notification.getCreatedAt(),
            notification.getType().category()
        );
    }
}
