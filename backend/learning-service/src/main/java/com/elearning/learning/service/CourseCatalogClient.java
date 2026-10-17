package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.MDC;
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

    public void requireExistingCourse(Long courseId) {
        fetchCourse(courseId);
    }

    public void requireFreeCourse(Long courseId) {
        CourseReference course = fetchCourse(courseId);
        if (
            !"PUBLISHED".equals(course.status()) ||
            course.price() == null ||
            course.price().compareTo(BigDecimal.ZERO) != 0
        ) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
    }

    public Curriculum getCurriculum(Long courseId) {
        CourseReference course = fetchCourse(courseId);
        try {
            CurriculumEnvelope response = client
                .get()
                .uri("/api/v1/courses/{id}/sections", courseId)
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
                .body(CurriculumEnvelope.class);
            if (
                response == null ||
                !response.success() ||
                response.data() == null ||
                response
                    .data()
                    .stream()
                    .anyMatch(
                        section ->
                            section == null ||
                            section.id() == null ||
                            !courseId.equals(section.courseId()) ||
                            section.lessons() == null ||
                            section
                                .lessons()
                                .stream()
                                .anyMatch(
                                    lesson ->
                                        lesson == null ||
                                        lesson.id() == null ||
                                        !section.id().equals(lesson.sectionId())
                                )
                    )
            ) {
                throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
            }
            return new Curriculum(courseId, course.title(), response.data());
        } catch (RestClientException ex) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    public record Curriculum(Long courseId, String title, List<SectionReference> sections) {
        public Set<Long> lessonIds() {
            return sections
                .stream()
                .flatMap(section -> section.lessons().stream())
                .map(LessonReference::id)
                .collect(Collectors.toSet());
        }

        public void requireLesson(Long lessonId) {
            if (!lessonIds().contains(lessonId)) throw new AppException(ErrorCode.NOT_FOUND);
        }
    }

    public record SectionReference(
        Long id,
        Long courseId,
        String title,
        int orderIndex,
        List<LessonReference> lessons
    ) {}

    public record LessonReference(
        Long id,
        Long sectionId,
        String title,
        String lessonType,
        String content,
        String videoUrl,
        Integer duration,
        int orderIndex,
        boolean preview
    ) {}

    private record CurriculumEnvelope(boolean success, List<SectionReference> data) {}

    private CourseReference fetchCourse(Long courseId) {
        try {
            CourseEnvelope response = client
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
            if (
                response == null ||
                !response.success() ||
                response.data() == null ||
                !courseId.equals(response.data().id())
            ) {
                throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
            }
            return response.data();
        } catch (RestClientException ex) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
    }

    private record CourseEnvelope(boolean success, CourseReference data) {}

    private record CourseReference(Long id, BigDecimal price, String status, String title) {}
}
