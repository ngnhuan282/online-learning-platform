package com.elearning.auth.common.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    REFRESH_TOKEN_MISSING(HttpStatus.UNAUTHORIZED, "Refresh authentication is required"),
    REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "Refresh authentication is invalid"),
    REFRESH_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "Refresh authentication has expired"),
    REFRESH_TOKEN_REVOKED(HttpStatus.UNAUTHORIZED, "Refresh authentication has been revoked"),
    EMAIL_ALREADY_EXISTS(HttpStatus.CONFLICT, "Email is already registered"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Email or password is incorrect"),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "User not found"),
    ACCOUNT_DISABLED(HttpStatus.FORBIDDEN, "Account is disabled"),
    ACCOUNT_LOCKED(HttpStatus.FORBIDDEN, "Account is locked"),
    ROLE_NOT_FOUND(HttpStatus.INTERNAL_SERVER_ERROR, "Account role configuration is unavailable"),
    OLD_PASSWORD_INCORRECT(HttpStatus.BAD_REQUEST, "Current password is incorrect"),
    CANNOT_LOCK_SELF(HttpStatus.BAD_REQUEST, "Cannot change your own account status"),
    CANNOT_DEMOTE_SELF(HttpStatus.BAD_REQUEST, "Cannot remove your own admin privileges"),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "Authentication is required or the token is invalid"),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "Access is denied"),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "Request validation failed"),
    MALFORMED_REQUEST(HttpStatus.BAD_REQUEST, "Malformed request body"),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "Invalid request"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication is required or the token is invalid"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Access is denied"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Resource not found"),
    CONFLICT(HttpStatus.CONFLICT, "Resource conflict"),
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
