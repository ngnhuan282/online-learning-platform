package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.dto.LessonPlayResponse;
import com.elearning.course.service.LessonService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/courses/{courseId}/lessons/{lessonId}")
public class LessonPlayController {

    private final LessonService lessonService;

    public LessonPlayController(LessonService lessonService) {
        this.lessonService = lessonService;
    }

    @GetMapping("/play-url")
    public ApiResponse<LessonPlayResponse> getPlayUrl(
        @PathVariable Long courseId,
        @PathVariable Long lessonId,
        Authentication authentication
    ) {
        Long userId = null;
        boolean isAdmin = false;

        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getPrincipal())) {
            try {
                userId = Long.parseLong(authentication.getName());
            } catch (NumberFormatException ignored) {
            }

            isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()) || "COURSE_UPDATE".equals(a.getAuthority()));
        }

        return ApiResponse.success(lessonService.getPlayUrl(courseId, lessonId, userId, isAdmin));
    }
}
