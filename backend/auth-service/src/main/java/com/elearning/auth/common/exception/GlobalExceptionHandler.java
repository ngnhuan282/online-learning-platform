package com.elearning.auth.common.exception;

import com.elearning.auth.common.response.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AppException.class)
    ResponseEntity<ApiError> handleAppException(AppException ex, HttpServletRequest request) {
        return respond(ex.getErrorCode(), null, request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidationException(
        MethodArgumentNotValidException ex,
        HttpServletRequest request
    ) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        ex.getBindingResult()
            .getFieldErrors()
            .forEach(error ->
                errors
                    .computeIfAbsent(error.getField(), key -> new ArrayList<>())
                    .add(error.getDefaultMessage())
            );
        ex.getBindingResult()
            .getGlobalErrors()
            .forEach(error ->
                errors.computeIfAbsent("_global", key -> new ArrayList<>()).add(error.getDefaultMessage())
            );
        return respond(ErrorCode.VALIDATION_ERROR, errors, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiError> handleConstraintViolation(
        ConstraintViolationException ex,
        HttpServletRequest request
    ) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(error ->
            errors
                .computeIfAbsent(error.getPropertyPath().toString(), key -> new ArrayList<>())
                .add(error.getMessage())
        );
        return respond(ErrorCode.VALIDATION_ERROR, errors, request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> handleArgumentTypeMismatch(
        MethodArgumentTypeMismatchException ex,
        HttpServletRequest request
    ) {
        // Do not echo rejected values or Java conversion details to the caller.
        return respond(
            ErrorCode.VALIDATION_ERROR,
            Map.of(ex.getName(), List.of("Invalid parameter value")),
            request
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return respond(ErrorCode.FORBIDDEN, null, request);
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ApiError> handleAuthenticationException(
        AuthenticationException ex,
        HttpServletRequest request
    ) {
        return respond(ErrorCode.UNAUTHORIZED, null, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleMalformedRequest(
        HttpMessageNotReadableException ex,
        HttpServletRequest request
    ) {
        return respond(ErrorCode.MALFORMED_REQUEST, null, request);
    }

    @ExceptionHandler({org.springframework.dao.DataIntegrityViolationException.class,
        org.springframework.dao.OptimisticLockingFailureException.class})
    ResponseEntity<ApiError> handleConflict(Exception ex, HttpServletRequest request) {
        return respond(ErrorCode.CONFLICT, null, request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpectedException(Exception ex, HttpServletRequest request) {
        // Preserve framework statuses (404/405/415/etc.) without returning internal exception details.
        if (ex instanceof ErrorResponse framework) {
            int status = framework.getStatusCode().value();
            if (status < 500) {
                log.warn("Request rejected status={} exception={}", status, ex.getClass().getSimpleName());
                return ResponseEntity.status(status).body(
                    new ApiError(
                        false,
                        switch (status) {
                            case 404 -> "NOT_FOUND";
                            case 405 -> "METHOD_NOT_ALLOWED";
                            case 415 -> "UNSUPPORTED_MEDIA_TYPE";
                            default -> "BAD_REQUEST";
                        },
                        "Request could not be processed",
                        null,
                        Instant.now(),
                        request.getRequestURI()
                    )
                );
            }
        }
        log.error("Unhandled server exception", ex);
        return respond(ErrorCode.INTERNAL_ERROR, null, request);
    }

    private ResponseEntity<ApiError> respond(
        ErrorCode code,
        Map<String, List<String>> errors,
        HttpServletRequest request
    ) {
        log.warn("Request rejected code={}", code);
        return ResponseEntity.status(code.status()).body(ApiError.of(code, errors, request.getRequestURI()));
    }
}
