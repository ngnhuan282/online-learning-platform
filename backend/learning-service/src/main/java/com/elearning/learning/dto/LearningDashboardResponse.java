package com.elearning.learning.dto;

import java.util.List;

public record LearningDashboardResponse(
    long activeEnrollments,
    long completedEnrollments,
    long completedLessons,
    long unreadNotifications,
    List<EnrollmentResponse> recentEnrollments,
    List<QuizResultResponse> recentQuizResults,
    List<NotificationResponse> notifications
) {}
