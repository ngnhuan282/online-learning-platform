package com.elearning.ai.service;

import com.elearning.ai.common.exception.AppException;
import com.elearning.ai.common.exception.ErrorCode;
import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;

@Component
public class LearningContextClient {

    private final RestClient courses;
    private final RestClient learning;

    public LearningContextClient(
        @Value("${course.service-url}") String courseUrl,
        @Value("${learning.service-url}") String learningUrl
    ) {
        courses = client(courseUrl);
        learning = client(learningUrl);
    }

    public Context resolve(Long courseId, Long lessonId, String authorization) {
        if (courseId == null) {
            if (lessonId != null) throw new AppException(ErrorCode.BAD_REQUEST);
            return new Context(null, "No course or lesson selected.");
        }
        // Recheck enrollment on every generation, not only when the conversation is created.
        JsonNode enrolled = get(learning, "/api/v1/learning/courses/" + courseId, authorization);
        if (enrolled.path("courseId").asLong() != courseId) unavailable();
        JsonNode course = get(courses, "/api/v1/courses/" + courseId, authorization);
        if (course.path("id").asLong() != courseId || !"PUBLISHED".equals(course.path("status").asString())) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        String title = limited(course.path("title").asString(""), 255);
        String text =
            "Course: " + title + "\nDescription: " + limited(course.path("description").asString(""), 2000);
        if (lessonId != null) {
            JsonNode sections = get(courses, "/api/v1/courses/" + courseId + "/sections", authorization);
            for (JsonNode section : sections) {
                if (section.path("courseId").asLong() != courseId) unavailable();
                for (JsonNode lesson : section.path("lessons")) {
                    if (lesson.path("id").asLong() == lessonId) {
                        if (lesson.path("sectionId").asLong() != section.path("id").asLong()) unavailable();
                        String lessonTitle = lesson.path("title").asString("");
                        String content = lesson.path("content").asString("").strip();
                        String lessonText = content.isBlank()
                            ? "[No lesson text is available. Only the lesson title is provided.]"
                            : limited(content, 10000) +
                              (content.length() > 10000
                                  ? "\n[Lesson text truncated; the remainder is not provided.]"
                                  : "");
                        // Forward only authorized text, never media URLs, signed tickets or user details.
                        return new Context(
                            limited(title + " / " + lessonTitle, 255),
                            text + "\nLesson: " + limited(lessonTitle, 255) + "\nLesson text: " + lessonText
                        );
                    }
                }
            }
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        return new Context(title, text);
    }

    private JsonNode get(RestClient client, String path, String authorization) {
        if (
            authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)
        ) throw new AppException(ErrorCode.UNAUTHORIZED);
        try {
            JsonNode envelope = client
                .get()
                .uri(path)
                .header("Authorization", authorization)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    throw new AppException(
                        switch (response.getStatusCode().value()) {
                            case 401 -> ErrorCode.UNAUTHORIZED;
                            case 403 -> ErrorCode.FORBIDDEN;
                            case 404 -> ErrorCode.NOT_FOUND;
                            default -> ErrorCode.AI_CONTEXT_UNAVAILABLE;
                        }
                    );
                })
                .body(JsonNode.class);
            if (
                envelope == null ||
                !envelope.path("success").asBoolean() ||
                envelope.path("data").isNull() ||
                envelope.path("data").isMissingNode()
            ) unavailable();
            return envelope.path("data");
        } catch (RestClientException exception) {
            throw new AppException(ErrorCode.AI_CONTEXT_UNAVAILABLE);
        }
    }

    private RestClient client(String url) {
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    private void unavailable() {
        throw new AppException(ErrorCode.AI_CONTEXT_UNAVAILABLE);
    }

    private String limited(String value, int length) {
        return value.substring(0, Math.min(value.length(), length));
    }

    public record Context(String title, String text) {}
}
