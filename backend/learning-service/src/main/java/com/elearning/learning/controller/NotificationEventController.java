package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.NotificationEventRequest;
import com.elearning.learning.dto.NotificationResponse;
import com.elearning.learning.service.NotificationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/internal/v1/notifications/events")
public class NotificationEventController {

    private final NotificationService notifications;

    public NotificationEventController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @PostMapping
    public ApiResponse<NotificationResponse> receive(@Valid @RequestBody NotificationEventRequest event) {
        return ApiResponse.success(notifications.receive(event));
    }
}
