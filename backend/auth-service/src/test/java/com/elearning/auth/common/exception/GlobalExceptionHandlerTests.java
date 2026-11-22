package com.elearning.auth.common.exception;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validation;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.server.ResponseStatusException;

class GlobalExceptionHandlerTests {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private final MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth");

    @Test
    void reportsGlobalValidationErrors() throws NoSuchMethodException {
        var result = new BeanPropertyBindingResult(new Object(), "form");
        result.addError(new ObjectError("form", "Passwords do not match"));
        var parameter = new MethodParameter(
            GlobalExceptionHandlerTests.class.getDeclaredMethod("accept", String.class),
            0
        );

        var response = handler.handleValidationException(
            new MethodArgumentNotValidException(parameter, result),
            request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().errors()).containsEntry("_global", List.of("Passwords do not match"));
    }

    @Test
    void reportsConstraintViolationsByProperty() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var violations = factory.getValidator().validate(new RequiredEmail(""));
            var response = handler.handleConstraintViolation(
                new ConstraintViolationException(violations),
                request
            );

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody().errors()).containsEntry("email", List.of("Email is required"));
            assertThat(response.getBody().path()).isEqualTo("/api/v1/auth");
        }
    }

    @Test
    void mapsAuthorizationAndAuthenticationFailuresToPublicCodes() {
        var denied = handler.handleAccessDenied(new AccessDeniedException("internal permission"), request);
        var invalid = handler.handleAuthenticationException(
            new BadCredentialsException("internal credential"),
            request
        );

        assertThat(denied.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(denied.getBody().code()).isEqualTo("FORBIDDEN");
        assertThat(denied.getBody().message()).doesNotContain("internal permission");
        assertThat(invalid.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(invalid.getBody().code()).isEqualTo("UNAUTHORIZED");
        assertThat(invalid.getBody().message()).doesNotContain("internal credential");
    }

    @ParameterizedTest
    @CsvSource({
        "NOT_FOUND, NOT_FOUND",
        "METHOD_NOT_ALLOWED, METHOD_NOT_ALLOWED",
        "UNSUPPORTED_MEDIA_TYPE, UNSUPPORTED_MEDIA_TYPE",
        "CONFLICT, BAD_REQUEST",
    })
    void preservesFrameworkStatusAndHidesItsReason(HttpStatus status, String code) {
        var response = handler.handleUnexpectedException(
            new ResponseStatusException(status, "internal detail"),
            request
        );

        assertThat(response.getStatusCode()).isEqualTo(status);
        assertThat(response.getBody().code()).isEqualTo(code);
        assertThat(response.getBody().message()).isEqualTo("Request could not be processed");
    }

    private static void accept(String form) {}

    private record RequiredEmail(
        @jakarta.validation.constraints.NotBlank(message = "Email is required") String email
    ) {}
}
