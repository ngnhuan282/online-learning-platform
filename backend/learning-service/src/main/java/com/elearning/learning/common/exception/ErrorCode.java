package com.elearning.learning.common.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Request validation failed"),
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST, "Malformed request body"),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "Invalid request"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication is required or the token is invalid"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Access is denied"),
    PRO_REQUIRED(HttpStatus.FORBIDDEN, "An active Pro membership is required"),
    INVALID_ACTIVATION_CODE(HttpStatus.BAD_REQUEST, "Activation code is invalid or unavailable"),
    ACTIVATION_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Too many activation attempts; try again later"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Resource not found"),
    CONFLICT(HttpStatus.CONFLICT, "Resource conflict"),
    INSUFFICIENT_GEMS(HttpStatus.CONFLICT, "Not enough gems for this purchase"),
    INVENTORY_FULL(HttpStatus.CONFLICT, "Streak freeze inventory is full"),
    NOTE_LIMIT_REACHED(
        HttpStatus.CONFLICT,
        "Gói miễn phí chỉ lưu tối đa 100 ghi chú. Nâng cấp Pro để lưu không giới hạn."
    ),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Please wait before posting again"),
    SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Dependent service is unavailable"),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed"),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type"),
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
