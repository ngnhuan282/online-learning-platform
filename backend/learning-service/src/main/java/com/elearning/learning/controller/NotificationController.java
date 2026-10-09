package com.elearning.learning.controller;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.common.response.ApiError;
import com.elearning.learning.common.response.PageResponse;
import com.elearning.learning.dto.NotificationResponse;
import com.elearning.learning.dto.NotificationSummaryResponse;
import com.elearning.learning.entity.enums.NotificationCategory;
import com.elearning.learning.security.JwtTokenProvider;
import com.elearning.learning.service.NotificationService;
import com.elearning.learning.service.NotificationStreamService;
import java.security.Principal;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/v1/learning/notifications")
public class NotificationController {

    private final NotificationService notifications;
    private final NotificationStreamService streams;
    private final JwtTokenProvider tokens;

    public NotificationController(
        NotificationService notifications, NotificationStreamService streams, JwtTokenProvider tokens
    ) {
        this.notifications = notifications;
        this.streams = streams;
        this.tokens = tokens;
    }

    @GetMapping("/feed")
    public ApiResponse<PageResponse<NotificationResponse>> feed(
        Principal principal,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) NotificationCategory category,
        @RequestParam(defaultValue = "false") boolean unreadOnly
    ) {
        return ApiResponse.success(notifications.feed(userId(principal), page, size, category, unreadOnly));
    }

    @GetMapping("/summary")
    public ApiResponse<NotificationSummaryResponse> summary(Principal principal) {
        return ApiResponse.success(notifications.summary(userId(principal)));
    }

    @PatchMapping("/read-all")
    public ApiResponse<NotificationSummaryResponse> readAll(Principal principal) {
        return ApiResponse.success(notifications.markAllRead(userId(principal)));
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> stream(
        Principal principal, @RequestHeader("Authorization") String authorization
    ) {
        var claims = tokens.validate(authorization.substring(7));
        return ResponseEntity.ok()
            .header("Cache-Control", "no-store")
            .header("X-Accel-Buffering", "no")
            .body(streams.open(userId(principal), claims.getExpiration().toInstant()));
    }

    private Long userId(Principal principal) {
        try {
            long id = Long.parseLong(principal.getName());
            if (id <= 0) throw new NumberFormatException();
            return id;
        } catch (NumberFormatException ex) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> invalidFilter(HttpServletRequest request) {
        return ResponseEntity.badRequest().body(ApiError.of(ErrorCode.BAD_REQUEST, null, request.getRequestURI()));
    }

    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void disconnectedClient() {
        // A closed SSE response cannot accept an error envelope.
    }
}
