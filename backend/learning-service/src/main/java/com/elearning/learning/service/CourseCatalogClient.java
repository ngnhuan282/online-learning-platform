package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class CourseCatalogClient {

    private final RestClient client;

    public CourseCatalogClient(@Value("${course.service-url:http://localhost:8082}") String serviceUrl) {
        HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        this.client = RestClient.builder()
            .baseUrl(serviceUrl)
            .requestFactory(requestFactory)
            .build();
    }

    public void requireExistingCourse(Long courseId) {
        try {
            CourseEnvelope response = client.get()
                .uri("/api/v1/courses/{id}", courseId)
                .retrieve()
                .onStatus(status -> status.value() == 404, (request, result) -> {
                    throw new AppException(ErrorCode.NOT_FOUND);
                })
                .onStatus(HttpStatusCode::isError, (request, result) -> {
                    throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
                })
                .body(CourseEnvelope.class);
            if (response == null || !response.success() || response.data() == null
                || !courseId.equals(response.data().id())) {
                throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
            }
        } catch (RestClientException ex) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    private record CourseEnvelope(boolean success, CourseReference data) {}

    private record CourseReference(Long id) {}
}
