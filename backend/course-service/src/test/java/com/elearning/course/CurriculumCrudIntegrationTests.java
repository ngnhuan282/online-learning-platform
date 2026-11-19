package com.elearning.course;

import static org.assertj.core.api.Assertions.*;

import com.elearning.course.repository.*;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:curriculum-crud;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "security.jwt.secret=curriculum-crud-secret-at-least-32-bytes", "logging.level.root=WARN"
})
@ActiveProfiles("test")
class CurriculumCrudIntegrationTests {
    static final String SECRET = "curriculum-crud-secret-at-least-32-bytes";
    @LocalServerPort int port;
    @Autowired JsonMapper mapper;
    @Autowired ReviewRepository reviews;
    @Autowired LessonResourceRepository resources;
    final HttpClient client = HttpClient.newHttpClient();

    @Test
    void curriculumAndAttachmentLifecyclePersistsThroughControllersAndRepositories() throws Exception {
        long category = createCategory();
        long course = createCourse(category);
        long section = ok("POST", "/admin/courses/" + course + "/sections", Map.of("title", "Section", "orderIndex", 0)).get("id").asLong();
        ok("PUT", "/admin/courses/" + course + "/sections/" + section, Map.of("title", "Updated", "orderIndex", 1));
        ok("PUT", "/admin/courses/" + course + "/sections/reorder", Map.of("items", List.of(Map.of("id", section, "orderIndex", 0))));
        var lessonBody = Map.of("title", "Preview lesson", "lessonType", "TEXT", "content", "Practice", "preview", true, "orderIndex", 0);
        long lesson = ok("POST", "/admin/sections/" + section + "/lessons", lessonBody).get("id").asLong();
        ok("PUT", "/admin/lessons/" + lesson, lessonBody);
        ok("PUT", "/admin/sections/" + section + "/lessons/reorder", Map.of("items", List.of(Map.of("id", lesson, "orderIndex", 0))));
        long resource = ok("POST", "/admin/lessons/" + lesson + "/resources", Map.of(
            "resourceType", "PDF", "title", "Notes", "fileName", "notes.pdf", "fileSize", 20,
            "contentType", "application/pdf", "objectKey", "docs/crud-notes.pdf"
        )).get("id").asLong();
        var attachment = ok("GET", "/lessons/" + lesson + "/resources", null).get(0);
        assertThat(attachment.get("downloadUrl").asString()).contains("&signature=");
        assertThat(resources.findByLessonIdOrderByCreatedAtAsc(lesson)).extracting("id").containsExactly(resource);
        assertThat(ok("GET", "/courses/" + course + "/sections", null).get(0).get("title").asString()).isEqualTo("Updated");
        ok("DELETE", "/admin/resources/" + resource, null);
        assertThat(resources.findById(resource)).isEmpty();
        ok("DELETE", "/admin/lessons/" + lesson, null);
        ok("DELETE", "/admin/courses/" + course + "/sections/" + section, null);
        assertThat(ok("GET", "/courses/" + course + "/sections", null)).isEmpty();
        ok("GET", "/admin/categories", null);
        ok("GET", "/categories/" + category, null);
        ok("PUT", "/admin/categories/" + category, Map.of("name", "Updated " + category, "active", false));
        assertThat(request("GET", "/categories/" + category, null, null).statusCode()).isEqualTo(404);
        ok("DELETE", "/admin/categories/" + category, null);
        ok("DELETE", "/admin/courses/" + course, null);
        assertThat(ok("GET", "/admin/courses/" + course, null).get("status").asString()).isEqualTo("ARCHIVED");
    }

    @Test
    void reviewOwnershipVisibilityAndRepositoryAggregatesStayConsistent() throws Exception {
        long course = createCourse(createCategory());
        String base = "/courses/" + course + "/reviews";
        long id = ok("POST", base, Map.of("rating", 5, "comment", "Useful", "userFullName", "Learner")).get("id").asLong();
        assertThat(reviews.existsByCourseIdAndUserId(course, 7L)).isTrue();
        assertThat(reviews.avgRatingByCourseId(course)).isEqualTo(5);
        assertThat(ok("GET", base + "/me", null).get("id").asLong()).isEqualTo(id);
        assertThat(request("PUT", base + "/" + id, Map.of("rating", 1), token(8, "USER")).statusCode()).isEqualTo(403);
        assertThat(request("POST", base, Map.of("rating", 5), token(7, "ADMIN")).statusCode()).isEqualTo(409);
        ok("PUT", base + "/" + id, Map.of("rating", 4, "comment", "Updated"));
        ok("PUT", "/admin/courses/" + course + "/reviews/" + id + "/hide", Map.of());
        assertThat(reviews.findByCourseIdAndHiddenFalse(course, PageRequest.of(0, 10))).isEmpty();
        assertThat(reviews.avgRatingByCourseId(course)).isZero();
        assertThat(reviews.countByCourseId(course)).isZero();
        assertThat(ok("GET", "/admin/reviews?courseId=" + course, null).get("totalElements").asLong()).isEqualTo(1);
        ok("GET", "/admin/reviews", null);
        ok("GET", "/admin/courses/" + course + "/reviews", null);
        ok("PUT", "/admin/courses/" + course + "/reviews/" + id + "/show", Map.of());
        ok("PATCH", "/admin/reviews/" + id + "/visibility", Map.of("hidden", true));
        ok("PATCH", "/admin/reviews/" + id + "/visibility", Map.of("hidden", false));
        assertThat(reviews.countByCourseId(course)).isEqualTo(1);
        assertThat(ok("GET", base, null).get("content").size()).isEqualTo(1);
        ok("DELETE", base + "/" + id, null);
        assertThat(reviews.findByCourseIdAndUserId(course, 7L)).isEmpty();
        assertThat(ok("GET", base + "/me", null).isNull()).isTrue();
    }

    @Test
    void publishedCatalogAppliesRatingPriceAndStableSortWithoutLeakingDrafts() throws Exception {
        long category = createCategory();
        String admin = token(7, "ADMIN");
        String marker = "Catalog-" + UUID.randomUUID();
        var values = new LinkedHashMap<String, Object>(Map.of(
            "title", marker + " Alpha", "description", "Integration search", "categoryId", category,
            "price", 15000, "status", "PUBLISHED", "level", "BEGINNER"
        ));
        long first = ok("POST", "/admin/courses", values).path("id").asLong();
        values.put("title", marker + " Beta");
        values.put("price", 30000);
        long second = ok("POST", "/admin/courses", values).path("id").asLong();
        values.put("title", marker + " Draft");
        values.put("status", "DRAFT");
        ok("POST", "/admin/courses", values);
        ok("POST", "/courses/" + first + "/reviews", Map.of("rating", 5, "comment", "Good course"));
        String catalog = "/courses?keyword=" + marker + "&categoryId=" + category;
        var filtered = request("GET", catalog + "&minPrice=5000&maxPrice=25000&minRating=4&pricing=paid", null, null);
        assertThat(filtered.statusCode()).isEqualTo(200);
        assertThat(mapper.readTree(filtered.body()).path("data").path("content").get(0).path("id").asLong()).isEqualTo(first);
        for (String sort : List.of("price_desc", "price%2Cdesc", "rating_desc", "price_asc", "price%2Casc", "oldest", "createdat%2Casc", "title_asc")) {
            var data = mapper.readTree(request("GET", catalog + "&sort=" + sort + "&size=1", null, null).body()).path("data");
            assertThat(data.path("totalElements").asLong()).isEqualTo(2);
            assertThat(data.path("content").get(0).path("id").asLong()).isEqualTo(sort.endsWith("desc") && sort.startsWith("price") ? second : first);
        }
        for (String filter : List.of("minPrice=-1", "maxPrice=-1", "minPrice=2&maxPrice=1", "minRating=NaN", "pricing=bad", "keyword=" + "x".repeat(201))) {
            assertThat(request("GET", "/courses?" + filter, null, null).statusCode()).isEqualTo(400);
        }
        assertThat(ok("GET", "/admin/courses?page=0&size=1", null).path("totalElements").asLong()).isGreaterThanOrEqualTo(3);
        values.put("title", marker + " Alpha");
        assertThat(request("PUT", "/admin/courses/" + second, values, admin).statusCode()).isEqualTo(409);
        assertThat(request("GET", "/courses/" + first, null, null).statusCode()).isEqualTo(200);
    }

    @Test
    void controllersRejectInvalidPayloadsAndUnauthorizedWrites() throws Exception {
        assertThat(request("POST", "/admin/categories", Map.of("name", ""), token(7, "ADMIN")).statusCode()).isEqualTo(400);
        assertThat(request("POST", "/admin/categories", Map.of("name", "Denied"), token(8, "USER")).statusCode()).isEqualTo(403);
        assertThat(request("GET", "/courses?level=invalid", null, null).statusCode()).isEqualTo(400);
        assertThat(request("GET", "/courses?minPrice=invalid", null, null).statusCode()).isEqualTo(400);
        assertThat(request("POST", "/admin/lessons/1/resources", Map.of(), token(7, "ADMIN")).statusCode()).isEqualTo(400);
    }

    long createCategory() throws Exception {
        return ok("POST", "/admin/categories", Map.of("name", "CRUD " + UUID.randomUUID())).get("id").asLong();
    }
    long createCourse(long category) throws Exception {
        return ok("POST", "/admin/courses", Map.of("title", "CRUD " + UUID.randomUUID(), "description", "Integration course", "categoryId", category,
            "price", 0, "status", "PUBLISHED", "level", "BEGINNER")).get("id").asLong();
    }
    JsonNode ok(String method, String path, Object body) throws Exception {
        var response = request(method, path, body, token(7, "ADMIN"));
        assertThat(response.statusCode()).withFailMessage("%s %s: %s", method, path, response.body()).isEqualTo(200);
        return mapper.readTree(response.body()).get("data");
    }
    HttpResponse<String> request(String method, String path, Object body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1" + path)).header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return client.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
    }
    String token(long user, String role) {
        return Jwts.builder().subject(Long.toString(user)).issuer("sgedu").claim("role", role).claim("roles", List.of(role)).claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(5))).expiration(Date.from(Instant.now().plusSeconds(600)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }
}
