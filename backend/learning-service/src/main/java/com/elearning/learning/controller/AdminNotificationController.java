package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.common.response.ApiError;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.common.response.PageResponse;
import com.elearning.learning.dto.AdminNotificationRequest;
import com.elearning.learning.dto.AdminNotificationResponse;
import com.elearning.learning.dto.NotificationResponse;
import com.elearning.learning.entity.enums.NotificationCategory;
import com.elearning.learning.service.NotificationService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestController
@RequestMapping("/api/v1/learning/admin/notifications")
@PreAuthorize("hasRole('ADMIN')")
public class AdminNotificationController {

    private final NotificationService notifications;

    public AdminNotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public ApiResponse<PageResponse<AdminNotificationResponse>> list(
        @RequestParam(required = false) Long userId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) NotificationCategory category,
        @RequestParam(defaultValue = "false") boolean unreadOnly
    ) {
        return ApiResponse.success(notifications.adminFeed(userId, page, size, category, unreadOnly));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<NotificationResponse> send(@Valid @RequestBody AdminNotificationRequest request) {
        return ApiResponse.success(notifications.sendSystem(request));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> invalidFilter(HttpServletRequest request) {
        return ResponseEntity.badRequest().body(ApiError.of(ErrorCode.BAD_REQUEST, null, request.getRequestURI()));
    }
}
