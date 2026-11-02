package com.elearning.ai.common.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Request validation failed"),
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST, "Malformed request body"),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "Invalid request"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication is required or the token is invalid"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Access is denied"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Resource not found"),
    CONFLICT(HttpStatus.CONFLICT, "Resource conflict"),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed"),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type"),
    AI_NOT_AVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "AI provider is not configured"),
    AI_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "AI provider did not respond in time"),
    AI_QUOTA_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "AI quota or rate limit exceeded"),
    AI_PROVIDER_ERROR(HttpStatus.SERVICE_UNAVAILABLE, "AI provider is temporarily unavailable"),
    AI_CONFIGURATION_ERROR(HttpStatus.SERVICE_UNAVAILABLE, "AI provider configuration requires attention"),
    AI_CONTENT_BLOCKED(HttpStatus.UNPROCESSABLE_ENTITY, "AI could not answer this question"),
    AI_CONTEXT_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Learning context is temporarily unavailable"),
    AI_REQUEST_IN_PROGRESS(HttpStatus.CONFLICT, "A question is already being processed"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred");

    private final HttpStatus status;
    private final String message;

    ErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus status() {
        return status;
    }

    public String message() {
        return message;
    }
}
