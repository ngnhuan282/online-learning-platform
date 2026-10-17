package com.elearning.payment.course;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import java.math.BigDecimal;
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
public class CourseSnapshotProvider {

    private static final String PAYMENT_CURRENCY = "VND";

    private final RestClient client;

    public CourseSnapshotProvider(@Value("${course.service-url:http://localhost:8082}") String serviceUrl) {
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
    }

    public CourseSnapshot requirePurchasableCourse(Long courseId) {
        CourseEnvelope response;
        try {
            response = client
                .get()
                .uri("/api/v1/courses/{id}", courseId)
                .retrieve()
                .onStatus(
                    status -> status.value() == 404,
                    (request, result) -> {
                        throw new AppException(ErrorCode.NOT_FOUND);
                    }
                )
                .onStatus(HttpStatusCode::isError, (request, result) -> {
                    throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
                })
                .body(CourseEnvelope.class);
        } catch (RestClientException exception) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }

        if (
            response == null ||
            !response.success() ||
            response.data() == null ||
            !courseId.equals(response.data().id())
        ) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }

        CourseData course = response.data();
        if (!"PUBLISHED".equals(course.status())) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        if (
            course.title() == null ||
            course.title().isBlank() ||
            course.price() == null ||
            course.price().compareTo(BigDecimal.ZERO) <= 0
        ) {
            throw new AppException(ErrorCode.CONFLICT);
        }

        return new CourseSnapshot(course.id(), course.title().strip(), course.price(), PAYMENT_CURRENCY);
    }

    private record CourseEnvelope(boolean success, CourseData data) {}

    private record CourseData(Long id, String title, BigDecimal price, String status) {}
}
