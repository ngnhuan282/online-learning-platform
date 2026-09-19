package com.elearning.learning.service;

import com.elearning.learning.dto.*;
import java.util.List;

public interface LearningService {
    LearningDashboardResponse getDashboard(Long userId);

    List<EnrollmentResponse> getMyEnrollments(Long userId);

    EnrollmentResponse enroll(Long userId, EnrollRequest request);

    List<LessonProgressResponse> getCourseProgress(Long userId, Long courseId);

    QuizResponse getQuiz(Long quizId);

    QuizResultResponse getLatestQuizResult(Long userId, Long quizId);

    List<NotificationResponse> getNotifications(Long userId);

    NotificationResponse markNotificationRead(Long userId, Long notificationId);
}
