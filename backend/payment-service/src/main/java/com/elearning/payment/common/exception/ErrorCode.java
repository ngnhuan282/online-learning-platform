package com.elearning.payment.common.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Request validation failed"),
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST, "Malformed request body"),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "Invalid request"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication is required or the token is invalid"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Access is denied"),
    PAYMENT_MOCK_DISABLED(HttpStatus.FORBIDDEN, "MOCK payments are disabled; enable PAYMENT_MOCK_ENABLED explicitly for testing"),
    PAYMENT_CONFIGURATION_ERROR(HttpStatus.SERVICE_UNAVAILABLE, "VNPay Sandbox requires VNPAY_TMN_CODE and VNPAY_HASH_SECRET"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Resource not found"),
    CONFLICT(HttpStatus.CONFLICT, "Resource conflict"),
    SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Dependent service is unavailable"),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed"),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type"),
    FEATURE_NOT_IMPLEMENTED(HttpStatus.NOT_IMPLEMENTED, "Feature is not implemented yet"),
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
