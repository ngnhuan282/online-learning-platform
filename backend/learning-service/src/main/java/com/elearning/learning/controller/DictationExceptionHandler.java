package com.elearning.learning.controller;

import com.elearning.learning.common.exception.DictationValidationException;
import com.elearning.learning.common.response.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Order(0)
@RestControllerAdvice(assignableTypes = { DictationController.class, AdminDictationController.class })
public class DictationExceptionHandler {

    @ExceptionHandler(DictationValidationException.class)
    ResponseEntity<ApiError> validation(DictationValidationException ex, HttpServletRequest request) {
        return ResponseEntity.badRequest().body(
            new ApiError(
                false,
                "VALIDATION_ERROR",
                ex.getMessage(),
                null,
                Instant.now(),
                request.getRequestURI()
            )
        );
    }
}
