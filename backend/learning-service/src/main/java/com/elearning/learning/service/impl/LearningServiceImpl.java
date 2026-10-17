package com.elearning.learning.service.impl;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.*;
import com.elearning.learning.entity.Enrollment;
import com.elearning.learning.entity.LessonProgress;
import com.elearning.learning.entity.enums.AttemptStatus;
import com.elearning.learning.entity.enums.EnrollmentStatus;
import com.elearning.learning.entity.enums.ProgressStatus;
import com.elearning.learning.repository.*;
import com.elearning.learning.service.CourseCatalogClient;
import com.elearning.learning.service.LearningService;
import com.elearning.learning.service.NotificationService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LearningServiceImpl implements LearningService {

    private final EnrollmentRepository enrollments;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final NotificationService notifications;
    private final CourseCatalogClient courseCatalog;
    private final JdbcTemplate jdbc;

    public LearningServiceImpl(
        EnrollmentRepository enrollments,
        LessonProgressRepository progress,
        QuizAttemptRepository attempts,
        NotificationService notifications,
        CourseCatalogClient courseCatalog,
        JdbcTemplate jdbc
    ) {
        this.enrollments = enrollments;
        this.progress = progress;
        this.attempts = attempts;
        this.notifications = notifications;
        this.courseCatalog = courseCatalog;
        this.jdbc = jdbc;
    }

    @Override
    public LearningDashboardResponse getDashboard(Long userId) {
        return new LearningDashboardResponse(
            enrollments.countByUserIdAndStatus(userId, EnrollmentStatus.ACTIVE),
            enrollments.countByUserIdAndStatus(userId, EnrollmentStatus.COMPLETED),
            progress.countByUserIdAndStatus(userId, ProgressStatus.COMPLETED),
            notifications.summary(userId).unreadCount(),
            getMyEnrollments(userId).stream().limit(5).toList(),
            attempts
                .findTop5ByUserIdAndStatusOrderByIdDesc(userId, AttemptStatus.GRADED)
                .stream()
                .map(QuizResultResponse::from)
                .toList(),
            getNotifications(userId).stream().limit(5).toList()
        );
    }

    @Override
    public List<EnrollmentResponse> getMyEnrollments(Long userId) {
        return enrollments
            .findByUserIdOrderByLastAccessedAtDescEnrolledAtDesc(userId)
            .stream()
            .map(EnrollmentResponse::from)
            .toList();
    }

    @Override
    @Transactional
    public EnrollmentResponse enroll(Long userId, EnrollRequest request) {
        if (enrollments.existsByUserIdAndCourseId(userId, request.courseId())) {
            Enrollment enrollment = enrollments
                .findForUpdateByUserIdAndCourseId(userId, request.courseId())
                .orElseThrow();
            enrollment.setLastAccessedAt(Instant.now());
            return EnrollmentResponse.from(enrollments.save(enrollment));
        }

        courseCatalog.requireFreeCourse(request.courseId());
        Enrollment saved = createEnrollmentIfAbsent(userId, request.courseId(), null);
        notifications.courseEnrolled(userId, request.courseId(), saved.getId());
        return EnrollmentResponse.from(saved);
    }

    @Override
    @Transactional
    public EnrollmentResponse enrollFromPayment(PaymentEnrollmentRequest request) {
        String orderCode = request.orderCode().strip();
        // Keep an immutable order identity even when this user already owns the course.
        jdbc.update(
            """
            INSERT INTO payment_enrollment_receipts (order_code, user_id, course_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE order_code = order_code
            """,
            orderCode,
            request.userId(),
            request.courseId()
        );
        var receipt = jdbc.queryForObject(
            """
            SELECT order_code, user_id, course_id FROM payment_enrollment_receipts WHERE order_code = ? FOR UPDATE
            """,
            (row, index) ->
                new PaymentReceipt(
                    row.getString("order_code"),
                    row.getLong("user_id"),
                    row.getLong("course_id")
                ),
            orderCode
        );
        if (
            receipt == null ||
            !request.userId().equals(receipt.userId()) ||
            !request.courseId().equals(receipt.courseId())
        ) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        boolean existingCourse = enrollments.existsByUserIdAndCourseId(request.userId(), request.courseId());
        Enrollment saved = createEnrollmentIfAbsent(request.userId(), request.courseId(), orderCode);
        if (saved.getStatus() == EnrollmentStatus.CANCELLED) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        if (!existingCourse) notifications.courseEnrolled(
            request.userId(),
            request.courseId(),
            saved.getId()
        );
        notifications.paymentSucceeded(request.userId(), receipt.orderCode());
        return EnrollmentResponse.from(saved);
    }

    private record PaymentReceipt(String orderCode, Long userId, Long courseId) {}

    private Enrollment createEnrollmentIfAbsent(Long userId, Long courseId, String orderCode) {
        // The unique user/course key and atomic insert also cover simultaneous free/paid retries.
        jdbc.update(
            """
            INSERT INTO enrollments (user_id, course_id, source_order_code, status, enrolled_at, last_accessed_at)
            VALUES (?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE id = id
            """,
            userId,
            courseId,
            orderCode
        );
        return enrollments.findForUpdateByUserIdAndCourseId(userId, courseId).orElseThrow();
    }

    @Override
    public LearningCourseResponse getLearningCourse(Long userId, Long courseId) {
        ensureCourseAccess(userId, courseId);
        return LearningCourseResponse.from(
            courseCatalog.getCurriculum(courseId),
            getCourseProgress(userId, courseId)
        );
    }

    @Override
    public List<LessonProgressResponse> getCourseProgress(Long userId, Long courseId) {
        ensureCourseAccess(userId, courseId);
        return progress
            .findByUserIdAndCourseIdOrderByLessonIdAsc(userId, courseId)
            .stream()
            .map(LessonProgressResponse::from)
            .toList();
    }

    @Override
    @Transactional
    public LessonProgressResponse accessLesson(Long userId, Long courseId, Long lessonId) {
        Enrollment enrollment = ensureCourseAccessForUpdate(userId, courseId);
        courseCatalog.getCurriculum(courseId).requireLesson(lessonId);
        enrollment.setLastAccessedAt(Instant.now());
        LessonProgress item = progress
            .findByUserIdAndCourseIdAndLessonId(userId, courseId, lessonId)
            .orElseGet(() -> createLessonProgress(userId, courseId, lessonId));
        if (item.getStatus() == ProgressStatus.NOT_STARTED) {
            item.setStatus(ProgressStatus.IN_PROGRESS);
        }
        if (item.getProgressPercent() < 10) {
            item.setProgressPercent(10);
        }
        return LessonProgressResponse.from(progress.save(item));
    }

    @Override
    @Transactional
    public LessonProgressResponse markLessonComplete(Long userId, Long courseId, Long lessonId) {
        Enrollment enrollment = ensureCourseAccessForUpdate(userId, courseId);
        var curriculum = courseCatalog.getCurriculum(courseId);
        curriculum.requireLesson(lessonId);
        LessonProgress item = progress
            .findByUserIdAndCourseIdAndLessonId(userId, courseId, lessonId)
            .orElseGet(() -> createLessonProgress(userId, courseId, lessonId));
        boolean firstCompletion = item.getStatus() != ProgressStatus.COMPLETED;
        item.setStatus(ProgressStatus.COMPLETED);
        item.setProgressPercent(100);
        if (firstCompletion) item.setCompletedAt(Instant.now().truncatedTo(ChronoUnit.SECONDS));
        var saved = progress.saveAndFlush(item);
        var summary = LearningCourseResponse.from(curriculum, getCourseProgress(userId, courseId));
        enrollment.setLastAccessedAt(Instant.now());
        if (
            summary.totalLessons() > 0 &&
            summary.completedLessons() == summary.totalLessons() &&
            enrollment.getStatus() != EnrollmentStatus.COMPLETED
        ) {
            enrollment.setStatus(EnrollmentStatus.COMPLETED);
            enrollment.setCompletedAt(Instant.now());
        }
        if (firstCompletion) notifications.lessonCompleted(userId, courseId, lessonId);
        return LessonProgressResponse.from(saved);
    }

    @Override
    public List<NotificationResponse> getNotifications(Long userId) {
        return notifications.latest(userId);
    }

    @Override
    @Transactional
    public NotificationResponse markNotificationRead(Long userId, Long notificationId) {
        return notifications.markRead(userId, notificationId);
    }

    private void ensureCourseAccess(Long userId, Long courseId) {
        boolean enrolled = enrollments
            .findByUserIdAndCourseId(userId, courseId)
            .filter(enrollment -> enrollment.getStatus() != EnrollmentStatus.CANCELLED)
            .isPresent();
        if (!enrolled) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
    }

    private Enrollment ensureCourseAccessForUpdate(Long userId, Long courseId) {
        return enrollments
            .findForUpdateByUserIdAndCourseId(userId, courseId)
            .filter(enrollment -> enrollment.getStatus() != EnrollmentStatus.CANCELLED)
            .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN));
    }

    private LessonProgress createLessonProgress(Long userId, Long courseId, Long lessonId) {
        var item = new LessonProgress();
        item.setUserId(userId);
        item.setCourseId(courseId);
        item.setLessonId(lessonId);
        item.setStatus(ProgressStatus.NOT_STARTED);
        item.setProgressPercent(0);
        item.setTimeSpentSeconds(0L);
        return item;
    }

    @Override
    public EnrollmentCheckResponse checkEnrollment(Long userId, Long courseId) {
        if (userId == null || courseId == null) {
            return new EnrollmentCheckResponse(false, null, userId, courseId);
        }
        return enrollments
            .findByUserIdAndCourseId(userId, courseId)
            .filter(enrollment -> enrollment.getStatus() != EnrollmentStatus.CANCELLED)
            .map(enrollment -> new EnrollmentCheckResponse(true, enrollment.getStatus().name(), userId, courseId))
            .orElseGet(() -> new EnrollmentCheckResponse(false, null, userId, courseId));
    }
}
