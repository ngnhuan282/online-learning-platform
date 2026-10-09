package com.elearning.learning.dto;

import java.util.List;

public record NotificationSummaryResponse(long unreadCount, List<NotificationResponse> notifications) {}
