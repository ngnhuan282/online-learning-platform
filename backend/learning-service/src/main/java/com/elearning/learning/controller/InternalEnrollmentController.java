package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.EnrollmentResponse;
import com.elearning.learning.dto.PaymentEnrollmentRequest;
import com.elearning.learning.security.InternalServiceAuthenticator;
import com.elearning.learning.service.LearningService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/learning")
public class InternalEnrollmentController {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Service-Token";

    private final LearningService learning;
    private final InternalServiceAuthenticator authenticator;

    public InternalEnrollmentController(
        LearningService learning,
        InternalServiceAuthenticator authenticator
    ) {
        this.learning = learning;
        this.authenticator = authenticator;
    }

    @PostMapping("/enrollments")
    ApiResponse<EnrollmentResponse> enroll(
        @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String internalToken,
        @Valid @RequestBody PaymentEnrollmentRequest request
    ) {
        authenticator.requireValid(internalToken);
        return ApiResponse.success(learning.enrollFromPayment(request));
    }
}
