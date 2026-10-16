package com.elearning.ai.dto;

public record AiCapabilitiesResponse(boolean available, boolean historyAvailable, int maxMessageLength) {}
