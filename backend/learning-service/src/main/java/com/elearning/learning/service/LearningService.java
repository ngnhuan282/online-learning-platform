package com.elearning.learning.service;

import com.elearning.learning.dto.*;
import java.util.List;

public interface LearningService {
    LearningDashboardResponse getDashboard(Long userId);

    List<EnrollmentResponse> getMyEnrollments(Long userId);

    EnrollmentResponse enroll(Long userId, EnrollRequest request);

    EnrollmentResponse enrollFromPayment(PaymentEnrollmentRequest request);

    List<LessonProgressResponse> getCourseProgress(Long userId, Long courseId);

    LearningCourseResponse getLearningCourse(Long userId, Long courseId);

    LessonProgressResponse accessLesson(Long userId, Long courseId, Long lessonId);

    LessonProgressResponse markLessonComplete(Long userId, Long courseId, Long lessonId);

    List<NotificationResponse> getNotifications(Long userId);

    NotificationResponse markNotificationRead(Long userId, Long notificationId);
}
