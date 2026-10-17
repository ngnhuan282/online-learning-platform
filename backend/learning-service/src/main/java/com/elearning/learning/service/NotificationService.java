package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.common.response.PageResponse;
import com.elearning.learning.dto.NotificationEventRequest;
import com.elearning.learning.dto.NotificationResponse;
import com.elearning.learning.dto.NotificationSummaryResponse;
import com.elearning.learning.entity.enums.NotificationCategory;
import com.elearning.learning.entity.enums.NotificationType;
import com.elearning.learning.repository.NotificationRepository;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notifications;
    private final JdbcTemplate jdbc;
    private final NotificationStreamService streams;

    public NotificationService(
        NotificationRepository notifications,
        JdbcTemplate jdbc,
        NotificationStreamService streams
    ) {
        this.notifications = notifications;
        this.jdbc = jdbc;
        this.streams = streams;
    }

    public List<NotificationResponse> latest(Long userId) {
        return notifications.findTop20ByUserIdOrderByCreatedAtDescIdDesc(userId)
            .stream().map(NotificationResponse::from).toList();
    }

    public NotificationSummaryResponse summary(Long userId) {
        return new NotificationSummaryResponse(
            notifications.countByUserIdAndReadAtIsNull(userId),
            notifications.findTop5ByUserIdOrderByCreatedAtDescIdDesc(userId)
                .stream().map(NotificationResponse::from).toList()
        );
    }

    public PageResponse<NotificationResponse> feed(
        Long userId, int page, int size, NotificationCategory category, boolean unreadOnly
    ) {
        if (page < 0 || size < 1 || size > 100) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        List<NotificationType> types = Arrays.stream(NotificationType.values())
            .filter(type -> category == null || type.category() == category).toList();
        var pageable = PageRequest.of(page, size, Sort.by(
            Sort.Order.desc("createdAt"), Sort.Order.desc("id")
        ));
        return PageResponse.from(
            notifications.findFeed(userId, types, unreadOnly, pageable).map(NotificationResponse::from)
        );
    }

    @Transactional
    public NotificationResponse markRead(Long userId, Long id) {
        var notification = notifications.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (notification.getReadAt() == null) {
            notification.setReadAt(Instant.now().truncatedTo(ChronoUnit.SECONDS));
            changedAfterCommit(userId);
        }
        return NotificationResponse.from(notification);
    }

    @Transactional
    public NotificationSummaryResponse markAllRead(Long userId) {
        if (notifications.markAllRead(userId, Instant.now().truncatedTo(ChronoUnit.SECONDS)) > 0) {
            changedAfterCommit(userId);
        }
        return summary(userId);
    }

    @Transactional
    public void courseEnrolled(Long userId, Long courseId, Long enrollmentId) {
        create(userId, NotificationType.COURSE_ENROLLED, "enrollment:" + enrollmentId,
            "Ghi danh thành công", "Khóa học #" + courseId + " đã được thêm vào Khóa của tôi.",
            "/learning/" + courseId);
    }

    @Transactional
    public void paymentSucceeded(Long userId, String orderCode) {
        // Use the same event identity if Payment retries through the notifications receiver.
        receive(
            new NotificationEventRequest(orderCode, userId, NotificationType.PAYMENT_SUCCESS, null, orderCode)
        );
    }

    @Transactional
    public void lessonCompleted(Long userId, Long courseId, Long lessonId) {
        create(userId, NotificationType.LESSON_COMPLETED, "lesson:" + courseId + ":" + lessonId,
            "Hoàn thành bài học", "Bạn đã hoàn thành bài #" + lessonId + " của khóa học #" + courseId + ".",
            "/learning/" + courseId);
    }

    @Transactional
    public void quizResult(Long userId, Long attemptId, String quizTitle, int score, boolean passed) {
        create(userId, NotificationType.QUIZ_RESULT_AVAILABLE, "quiz:" + attemptId,
            "Có kết quả bài kiểm tra",
            quizTitle + ": " + score + "% — " + (passed ? "Đạt." : "Chưa đạt."),
            "/quizzes/attempts/" + attemptId + "/result");
    }

    @Transactional
    public NotificationResponse receive(NotificationEventRequest event) {
        String key = "external:" + event.type().name() + ":" + event.eventId();
        if (event.type() == NotificationType.COURSE_ENROLLED) {
            if (event.courseId() == null) throw new AppException(ErrorCode.BAD_REQUEST);
            return create(event.userId(), event.type(), key, "Ghi danh thành công",
                "Khóa học #" + event.courseId() + " đã được thêm vào Khóa của tôi.",
                "/learning/" + event.courseId());
        }
        if (event.type().category() != NotificationCategory.PAYMENT || event.orderCode() == null) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        String title = switch (event.type()) {
            case PAYMENT_SUCCESS -> "Thanh toán thành công";
            case PAYMENT_FAILED -> "Thanh toán thất bại";
            case PAYMENT_CANCELLED -> "Thanh toán đã bị hủy";
            case PAYMENT_REFUNDED -> "Thanh toán đã được hoàn tiền";
            default -> throw new AppException(ErrorCode.BAD_REQUEST);
        };
        return create(event.userId(), event.type(), key, title,
            title + " cho đơn hàng " + event.orderCode() + ".",
            "/payment/result?orderCode=" + URLEncoder.encode(event.orderCode(), StandardCharsets.UTF_8));
    }

    private NotificationResponse create(
        Long userId, NotificationType type, String key, String title, String body, String actionUrl
    ) {
        // An atomic upsert avoids poisoning the business transaction on concurrent retries.
        jdbc.update("""
            INSERT INTO notifications (user_id, type, event_key, title, body, action_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE event_key = event_key
            """, userId, type.name(), key, title, body, actionUrl);
        // A locking read sees the winning row even under MySQL REPEATABLE READ.
        var notification = notifications.findByUserIdAndEventKey(userId, key).orElseThrow();
        changedAfterCommit(userId);
        return NotificationResponse.from(notification);
    }

    private void changedAfterCommit(Long userId) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                streams.changed(userId);
            }
        });
    }
}
