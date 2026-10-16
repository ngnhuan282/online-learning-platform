package com.elearning.payment.course;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

/**
 * HTTP client to fetch course price & status from Course Service.
 * Falls back to the hardcoded snapshot catalog when course-service is unreachable (resilient mode).
 */
@Component
public class CourseClient {

    private static final Logger log = LoggerFactory.getLogger(CourseClient.class);

    private final RestTemplate restTemplate;
    private final String courseServiceBaseUrl;
    private final CourseSnapshotProvider snapshotProvider;

    public CourseClient(
        RestTemplate restTemplate,
        @Value("${integrations.course.base-url:http://localhost:8082}") String courseServiceBaseUrl,
        CourseSnapshotProvider snapshotProvider
    ) {
        this.restTemplate = restTemplate;
        this.courseServiceBaseUrl = courseServiceBaseUrl;
        this.snapshotProvider = snapshotProvider;
    }

    /**
     * Fetches a CourseSnapshot from Course Service.
     * Falls back to snapshot provider if course-service is unavailable or not found.
     */
    @SuppressWarnings("unchecked")
    public Optional<CourseSnapshot> findById(Long courseId) {
        String url = courseServiceBaseUrl + "/api/v1/courses/" + courseId;
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = (Map<String, Object>) response.getBody();
                Object dataObj = body.get("data");
                if (dataObj instanceof Map<?, ?>) {
                    Map<String, Object> data = (Map<String, Object>) dataObj;
                    Long id = toLong(data.get("id"));
                    String title = (String) data.get("title");
                    BigDecimal price = toBigDecimal(data.get("price"));
                    String status = (String) data.get("status");

                    if (id != null && title != null && price != null) {
                        // Reject non-published courses — payment should not be possible
                        if (!"PUBLISHED".equalsIgnoreCase(status)) {
                            log.warn("Course {} is not PUBLISHED (status={}), rejecting checkout", courseId, status);
                            return Optional.empty();
                        }
                        return Optional.of(new CourseSnapshot(id, title, price, "VND"));
                    }
                }
            }
        } catch (HttpClientErrorException.NotFound e) {
            log.warn("Course {} not found in course-service, trying snapshot provider", courseId);
            return snapshotProvider.findById(courseId);
        } catch (Exception e) {
            log.info("Course service unreachable at {}. Using snapshot catalog for course {}: {}", url, courseId, e.getMessage());
            return snapshotProvider.findById(courseId);
        }
        return snapshotProvider.findById(courseId);
    }

    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
