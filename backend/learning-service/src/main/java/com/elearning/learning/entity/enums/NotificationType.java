package com.elearning.learning.entity.enums;

public enum NotificationType {
    ENROLLMENT(NotificationCategory.COURSE),
    PROGRESS(NotificationCategory.LEARNING),
    QUIZ(NotificationCategory.LEARNING),
    SYSTEM(NotificationCategory.SYSTEM),
    COURSE_ENROLLED(NotificationCategory.COURSE),
    PAYMENT_SUCCESS(NotificationCategory.PAYMENT),
    PAYMENT_FAILED(NotificationCategory.PAYMENT),
    PAYMENT_CANCELLED(NotificationCategory.PAYMENT),
    PAYMENT_REFUNDED(NotificationCategory.PAYMENT),
    LESSON_COMPLETED(NotificationCategory.LEARNING),
    QUIZ_RESULT_AVAILABLE(NotificationCategory.LEARNING);

    private final NotificationCategory category;

    NotificationType(NotificationCategory category) {
        this.category = category;
    }

    public NotificationCategory category() {
        return category;
    }
}
