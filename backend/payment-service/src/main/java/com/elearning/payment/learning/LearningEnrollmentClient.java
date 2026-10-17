package com.elearning.payment.learning;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import java.net.http.HttpClient;
import java.time.Duration;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class LearningEnrollmentClient {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Service-Token";

    private final RestClient client;
    private final String internalToken;

    public LearningEnrollmentClient(
        @Value("${learning.service-url:http://localhost:8083}") String serviceUrl,
        @Value("${integrations.internal-service-token}") String internalToken
    ) {
        if (
            internalToken == null ||
            internalToken.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 32
        ) {
            throw new IllegalArgumentException("INTERNAL_SERVICE_TOKEN must contain at least 32 UTF-8 bytes");
        }
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        this.client = RestClient.builder()
            .baseUrl(serviceUrl)
            .requestInterceptor((request, body, execution) -> {
                String requestId = MDC.get("requestId");
                if (requestId != null) request.getHeaders().set("X-Request-ID", requestId);
                return execution.execute(request, body);
            })
            .requestFactory(requestFactory)
            .build();
        this.internalToken = internalToken;
    }

    public void enroll(String orderCode, Long userId, Long courseId) {
        EnrollmentEnvelope response;
        try {
            response = client
                .post()
                .uri("/internal/v1/learning/enrollments")
                .header(INTERNAL_TOKEN_HEADER, internalToken)
                .body(new EnrollmentRequest(orderCode, userId, courseId))
                .retrieve()
                .onStatus(
                    status -> status.value() == 409,
                    (request, result) -> {
                        throw new AppException(ErrorCode.CONFLICT);
                    }
                )
                .onStatus(HttpStatusCode::isError, (request, result) -> {
                    throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
                })
                .body(EnrollmentEnvelope.class);
        } catch (RestClientException exception) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }

        if (
            response == null ||
            !response.success() ||
            response.data() == null ||
            !courseId.equals(response.data().courseId())
        ) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    private record EnrollmentRequest(String orderCode, Long userId, Long courseId) {}

    private record EnrollmentEnvelope(boolean success, EnrollmentData data) {}

    private record EnrollmentData(Long courseId) {}
}
