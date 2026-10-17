package com.elearning.learning.controller;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.*;
import com.elearning.learning.service.LearningService;
import com.elearning.learning.service.QuizService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning")
public class LearningController {

    private final LearningService learning;
    private final QuizService quizzes;

    public LearningController(LearningService learning, QuizService quizzes) {
        this.learning = learning;
        this.quizzes = quizzes;
    }

    @GetMapping("/dashboard")
    ApiResponse<LearningDashboardResponse> dashboard(Principal principal) {
        return ApiResponse.success(learning.getDashboard(userId(principal)));
    }

    @GetMapping("/enrollments/me")
    ApiResponse<?> myEnrollments(Principal principal) {
        return ApiResponse.success(learning.getMyEnrollments(userId(principal)));
    }

    @GetMapping("/enrollments/check")
    ApiResponse<EnrollmentCheckResponse> checkEnrollment(
        @RequestParam Long userId,
        @RequestParam Long courseId
    ) {
        return ApiResponse.success(learning.checkEnrollment(userId, courseId));
    }

    @PostMapping("/enrollments")
    ApiResponse<EnrollmentResponse> enroll(Principal principal, @Valid @RequestBody EnrollRequest request) {
        return ApiResponse.success(learning.enroll(userId(principal), request));
    }

    @GetMapping("/progress/courses/{courseId}")
    ApiResponse<?> courseProgress(Principal principal, @PathVariable Long courseId) {
        return ApiResponse.success(learning.getCourseProgress(userId(principal), courseId));
    }

    @GetMapping("/courses/{courseId}")
    ApiResponse<LearningCourseResponse> learningCourse(Principal principal, @PathVariable Long courseId) {
        return ApiResponse.success(learning.getLearningCourse(userId(principal), courseId));
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
    ApiResponse<QuizResponse> quiz(Principal principal, @PathVariable Long quizId) {
        return ApiResponse.success(quizzes.getPublished(userId(principal), quizId));
    }

    @GetMapping("/courses/{courseId}/quizzes")
    ApiResponse<?> courseQuizzes(Principal principal, @PathVariable Long courseId) {
        return ApiResponse.success(quizzes.listPublished(userId(principal), courseId));
    }

    @PostMapping("/quizzes/{quizId}/attempts")
    ApiResponse<QuizResultResponse> startQuiz(Principal principal, @PathVariable Long quizId) {
        return ApiResponse.success(quizzes.start(userId(principal), quizId));
    }

    @PostMapping("/quizzes/attempts/{attemptId}/submit")
    ApiResponse<QuizResultResponse> submitQuiz(
        Principal principal,
        @PathVariable Long attemptId,
        @Valid @RequestBody QuizSubmissionRequest request
    ) {
        return ApiResponse.success(quizzes.submit(userId(principal), attemptId, request));
    }

    @GetMapping("/quizzes/{quizId}/result")
    ApiResponse<QuizResultResponse> latestQuizResult(Principal principal, @PathVariable Long quizId) {
        return ApiResponse.success(quizzes.latestResult(userId(principal), quizId));
    }

    @GetMapping("/quizzes/attempts/{attemptId}/review")
    ApiResponse<QuizReviewResponse> reviewQuiz(Principal principal, @PathVariable Long attemptId) {
        return ApiResponse.success(quizzes.review(userId(principal), attemptId));
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
