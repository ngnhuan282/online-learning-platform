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
import com.elearning.learning.service.LearningService;
import com.elearning.learning.service.NotificationService;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LearningServiceImpl implements LearningService {

    private final EnrollmentRepository enrollments;
    private final LessonProgressRepository progress;
    private final QuizAttemptRepository attempts;
    private final NotificationService notifications;

    public LearningServiceImpl(
        EnrollmentRepository enrollments,
        LessonProgressRepository progress,
        QuizAttemptRepository attempts,
        NotificationService notifications
    ) {
        this.enrollments = enrollments;
        this.progress = progress;
        this.attempts = attempts;
        this.notifications = notifications;
    }

    @Override
    public LearningDashboardResponse getDashboard(Long userId) {
        return new LearningDashboardResponse(
            enrollments.countByUserIdAndStatus(userId, EnrollmentStatus.ACTIVE),
            enrollments.countByUserIdAndStatus(userId, EnrollmentStatus.COMPLETED),
            progress.countByUserIdAndStatus(userId, ProgressStatus.COMPLETED),
            notifications.summary(userId).unreadCount(),
            getMyEnrollments(userId).stream().limit(5).toList(),
            attempts.findTop5ByUserIdAndStatusOrderByIdDesc(userId, AttemptStatus.GRADED)
                .stream().map(QuizResultResponse::from).toList(),
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
        var existing = enrollments.findByUserIdAndCourseId(userId, request.courseId());
        if (existing.isPresent()) {
            Enrollment enrollment = existing.get();
            enrollment.setLastAccessedAt(Instant.now());
            return EnrollmentResponse.from(enrollments.save(enrollment));
        }

        var enrollment = new Enrollment();
        enrollment.setUserId(userId);
        enrollment.setCourseId(request.courseId());
        enrollment.setStatus(EnrollmentStatus.ACTIVE);
        enrollment.setLastAccessedAt(Instant.now());
        Enrollment saved = enrollments.save(enrollment);
        notifications.courseEnrolled(userId, request.courseId(), saved.getId());
        return EnrollmentResponse.from(saved);
    }

    @Override
    public List<LessonProgressResponse> getCourseProgress(Long userId, Long courseId) {
        ensureCourseAccess(userId, courseId);
        return progress.findByUserIdAndCourseIdOrderByLessonIdAsc(userId, courseId)
            .stream()
            .map(LessonProgressResponse::from)
            .toList();
    }

    @Override
    @Transactional
    public LessonProgressResponse accessLesson(Long userId, Long courseId, Long lessonId) {
        ensureCourseAccess(userId, courseId);
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
        ensureCourseAccess(userId, courseId);
        LessonProgress item = progress
            .findByUserIdAndCourseIdAndLessonId(userId, courseId, lessonId)
            .orElseGet(() -> createLessonProgress(userId, courseId, lessonId));
        boolean firstCompletion = item.getStatus() != ProgressStatus.COMPLETED;
        item.setStatus(ProgressStatus.COMPLETED);
        item.setProgressPercent(100);
        item.setCompletedAt(Instant.now());
        var saved = progress.save(item);
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
}
