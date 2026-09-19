package com.elearning.learning.service.impl;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.*;
import com.elearning.learning.entity.Enrollment;
import com.elearning.learning.entity.enums.EnrollmentStatus;
import com.elearning.learning.entity.enums.ProgressStatus;
import com.elearning.learning.repository.*;
import com.elearning.learning.service.LearningService;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LearningServiceImpl implements LearningService {

    private final EnrollmentRepository enrollments;
    private final LessonProgressRepository progress;
    private final QuizRepository quizzes;
    private final QuizAttemptRepository attempts;
    private final NotificationRepository notifications;

    public LearningServiceImpl(
        EnrollmentRepository enrollments,
        LessonProgressRepository progress,
        QuizRepository quizzes,
        QuizAttemptRepository attempts,
        NotificationRepository notifications
    ) {
        this.enrollments = enrollments;
        this.progress = progress;
        this.quizzes = quizzes;
        this.attempts = attempts;
        this.notifications = notifications;
    }

    @Override
    public LearningDashboardResponse getDashboard(Long userId) {
        return new LearningDashboardResponse(
            enrollments.countByUserIdAndStatus(userId, EnrollmentStatus.ACTIVE),
            enrollments.countByUserIdAndStatus(userId, EnrollmentStatus.COMPLETED),
            progress.countByUserIdAndStatus(userId, ProgressStatus.COMPLETED),
            notifications.countByUserIdAndReadAtIsNull(userId),
            getMyEnrollments(userId).stream().limit(5).toList(),
            attempts.findTop5ByUserIdOrderByStartedAtDesc(userId).stream().map(QuizResultResponse::from).toList(),
            getNotifications(userId).stream().limit(5).toList()
        );
    }

    @Override
    public List<EnrollmentResponse> getMyEnrollments(Long userId) {
        return enrollments.findByUserIdOrderByLastAccessedAtDescEnrolledAtDesc(userId)
            .stream()
            .map(EnrollmentResponse::from)
            .toList();
    }

    @Override
    @Transactional
    public EnrollmentResponse enroll(Long userId, EnrollRequest request) {
        Enrollment enrollment = enrollments
            .findByUserIdAndCourseId(userId, request.courseId())
            .orElseGet(() -> {
                var created = new Enrollment();
                created.setUserId(userId);
                created.setCourseId(request.courseId());
                created.setStatus(EnrollmentStatus.ACTIVE);
                return created;
            });
        enrollment.setLastAccessedAt(Instant.now());
        return EnrollmentResponse.from(enrollments.save(enrollment));
    }

    @Override
    public List<LessonProgressResponse> getCourseProgress(Long userId, Long courseId) {
        return progress.findByUserIdAndCourseIdOrderByUpdatedAtDesc(userId, courseId)
            .stream()
            .map(LessonProgressResponse::from)
            .toList();
    }

    @Override
    public QuizResponse getQuiz(Long quizId) {
        return quizzes
            .findWithQuestionsByIdAndPublishedTrue(quizId)
            .map(QuizResponse::from)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    @Override
    public QuizResultResponse getLatestQuizResult(Long userId, Long quizId) {
        return attempts
            .findTopByUserIdAndQuizIdOrderByStartedAtDesc(userId, quizId)
            .map(QuizResultResponse::from)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    @Override
    public List<NotificationResponse> getNotifications(Long userId) {
        return notifications.findTop20ByUserIdOrderByCreatedAtDesc(userId)
            .stream()
            .map(NotificationResponse::from)
            .toList();
    }

    @Override
    @Transactional
    public NotificationResponse markNotificationRead(Long userId, Long notificationId) {
        var notification = notifications
            .findById(notificationId)
            .filter(item -> item.getUserId().equals(userId))
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (notification.getReadAt() == null) {
            notification.setReadAt(Instant.now());
        }
        return NotificationResponse.from(notification);
    }
}
