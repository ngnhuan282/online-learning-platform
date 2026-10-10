ALTER TABLE notifications DROP ${notificationCheckKeyword} chk_notifications_type;

ALTER TABLE notifications
    ADD COLUMN event_key VARCHAR(200) ${notificationEventKeyCollation} NULL;

ALTER TABLE notifications
    ADD CONSTRAINT uk_notifications_user_event UNIQUE (user_id, event_key);

ALTER TABLE notifications
    ADD CONSTRAINT chk_notifications_type CHECK (
        type IN (
            'ENROLLMENT', 'PROGRESS', 'QUIZ', 'SYSTEM', 'COURSE_ENROLLED',
            'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'PAYMENT_REFUNDED',
            'LESSON_COMPLETED', 'QUIZ_RESULT_AVAILABLE'
        )
    );
