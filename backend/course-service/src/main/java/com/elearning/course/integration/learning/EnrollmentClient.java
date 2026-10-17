package com.elearning.course.integration.learning;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
public class EnrollmentClient {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentClient.class);

    private final RestClient restClient;
    private final boolean mockEnabled;

    public EnrollmentClient(
        @Value("${integrations.learning.url:http://localhost:8083}") String learningUrl,
        @Value("${integrations.learning.mock-enabled:false}") boolean mockEnabled
    ) {
        this.mockEnabled = mockEnabled;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = RestClient.builder()
            .baseUrl(learningUrl.trim().replaceAll("/+$", ""))
            .requestFactory(factory)
            .build();
    }

    public boolean isEnrolled(Long userId, Long courseId) {
        if (userId == null || courseId == null) {
            return false;
        }

        if (mockEnabled) {
            log.info("Learning mock enabled -> checking enrollment for userId={}, courseId={} (granted)", userId, courseId);
            return true;
        }

        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes request)) return false;
        String authorization = request.getRequest().getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) return false;

        try {
            var response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                    .path("/api/v1/learning/enrollments/check")
                    .queryParam("userId", userId)
                    .queryParam("courseId", courseId)
                    .build()
                )
                .header("Authorization", authorization)
                .retrieve()
                .body(new ParameterizedTypeReference<LearningApiResponse<EnrollmentCheckResult>>() {});

            if (response != null && response.payload() != null) {
                return response.payload().enrolled();
            }
            return false;
        } catch (Exception ex) {
            log.warn("Failed to check enrollment via Learning Service for userId={}, courseId={}: {}",
                userId, courseId, ex.getMessage());
            // An toàn trong môi trường test/dev: nếu learning-service không phản hồi nhưng mockEnabled = false,
            // ta trả false để đảm bảo an toàn bảo mật.
            return false;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LearningApiResponse<T>(Boolean success, Object code, String message, T data, T result) {
        public T payload() {
            return data != null ? data : result;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record EnrollmentCheckResult(boolean enrolled, String status, Long userId, Long courseId) {}
}
