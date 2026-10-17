package com.elearning.course.integration.learning;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class LearningAccessClient {

    private final RestClient client;

    public LearningAccessClient(@Value("${learning.service-url:http://localhost:8083}") String serviceUrl) {
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(5));
        client = RestClient.builder().baseUrl(serviceUrl).requestFactory(factory)
                .requestInterceptor((request, body, execution) -> {
                    String id = MDC.get("requestId");
                    if (id != null) request.getHeaders().set("X-Request-ID", id);
                    return execution.execute(request, body);
                }).build();
    }

    public boolean isEnrolled(Long courseId, String authorization) {
        try {
            // Learning derives the user from this validated JWT; no user ID from the caller.
            Envelope response = client.get().uri("/api/v1/learning/enrollments/me")
                    .header("Authorization", authorization).retrieve()
                    .onStatus(status -> status.value() == 401, (request, result) -> {
                        throw new AppException(ErrorCode.UNAUTHORIZED);
                    })
                    .onStatus(status -> status.isError(), (request, result) -> {
                        throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
                    }).body(Envelope.class);
            if (response == null || !response.success() || response.data() == null) {
                throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
            }
            return response.data().stream().anyMatch(item -> courseId.equals(item.courseId())
                    && ("ACTIVE".equals(item.status()) || "COMPLETED".equals(item.status())));
        } catch (RestClientException exception) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    private record Envelope(boolean success, List<Enrollment> data) {}

    private record Enrollment(Long courseId, String status) {}
}
