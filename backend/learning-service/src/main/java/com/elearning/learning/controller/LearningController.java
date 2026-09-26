package com.elearning.learning.controller;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.*;
import com.elearning.learning.service.LearningService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning")
public class LearningController {

    private final LearningService learning;

    public LearningController(LearningService learning) {
        this.learning = learning;
    }

    @GetMapping("/dashboard")
    ApiResponse<LearningDashboardResponse> dashboard(Principal principal) {
        return ApiResponse.success(learning.getDashboard(userId(principal)));
    }

    @GetMapping("/enrollments/me")
    ApiResponse<?> myEnrollments(Principal principal) {
        return ApiResponse.success(learning.getMyEnrollments(userId(principal)));
    }

    @PostMapping("/enrollments")
    ApiResponse<EnrollmentResponse> enroll(
        Principal principal,
        @Valid @RequestBody EnrollRequest request
    ) {
        return ApiResponse.success(learning.enroll(userId(principal), request));
    }

    @GetMapping("/progress/courses/{courseId}")
    ApiResponse<?> courseProgress(Principal principal, @PathVariable Long courseId) {
        return ApiResponse.success(learning.getCourseProgress(userId(principal), courseId));
    }

    @PostMapping("/progress/courses/{courseId}/lessons/{lessonId}/access")
    ApiResponse<LessonProgressResponse> accessLesson(
        Principal principal,
        @PathVariable Long courseId,
        @PathVariable Long lessonId
    ) {
        return ApiResponse.success(learning.accessLesson(userId(principal), courseId, lessonId));
    }

    @PatchMapping("/progress/courses/{courseId}/lessons/{lessonId}/complete")
    ApiResponse<LessonProgressResponse> markLessonComplete(
        Principal principal,
        @PathVariable Long courseId,
        @PathVariable Long lessonId
    ) {
        return ApiResponse.success(learning.markLessonComplete(userId(principal), courseId, lessonId));
    }

    @GetMapping("/quizzes/{quizId}")
    ApiResponse<QuizResponse> quiz(@PathVariable Long quizId) {
        return ApiResponse.success(learning.getQuiz(quizId));
    }

    @GetMapping("/quizzes/{quizId}/result")
    ApiResponse<QuizResultResponse> latestQuizResult(Principal principal, @PathVariable Long quizId) {
        return ApiResponse.success(learning.getLatestQuizResult(userId(principal), quizId));
    }

    @GetMapping("/notifications")
    ApiResponse<?> notifications(Principal principal) {
        return ApiResponse.success(learning.getNotifications(userId(principal)));
    }

    @PatchMapping("/notifications/{notificationId}/read")
    ApiResponse<NotificationResponse> markNotificationRead(
        Principal principal,
        @PathVariable Long notificationId
    ) {
        return ApiResponse.success(learning.markNotificationRead(userId(principal), notificationId));
    }

    private Long userId(Principal principal) {
        try {
            return Long.parseLong(principal.getName());
        } catch (NumberFormatException ex) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }
}
