package com.elearning.course;

import static org.assertj.core.api.Assertions.*;

import com.elearning.course.entity.*;
import com.elearning.course.repository.*;
import com.elearning.course.security.JwtTokenProvider;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:production-course;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "security.jwt.secret=production-course-test-secret-at-least-32-bytes",
    }
)
@ActiveProfiles("test")
class ProductionCourseTests {

    @Autowired
    CourseRepository courses;

    @Autowired
    CategoryRepository categories;

    @Autowired
    JwtTokenProvider tokens;

    @Autowired
    JsonMapper mapper;

    @LocalServerPort
    int port;

    final HttpClient client = HttpClient.newHttpClient();

    Category category() {
        var category = new Category();
        category.setName("Category " + UUID.randomUUID());
        category.setSlug(UUID.randomUUID().toString());
        return categories.saveAndFlush(category);
    }

    Course course(Category category, String title, int price, double rating) {
        var course = new Course();
        course.setTitle(title);
        course.setSlug(UUID.randomUUID().toString());
        course.setDescription("Search fixture");
        course.setCategory(category);
        course.setPrice(BigDecimal.valueOf(price));
        course.setStatus(CourseStatus.PUBLISHED);
        course.setAvgRating(rating);
        return courses.saveAndFlush(course);
    }

    HttpResponse<String> request(String path, String method, String role) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/v1" + path));
        if (role != null) builder.header(
            "Authorization",
            "Bearer " +
                Jwts.builder()
                    .subject("123")
                    .issuer("sgedu")
                    .claim("role", role)
                    .claim("tokenType", "access")
                    .issuedAt(Date.from(Instant.now()))
                    .expiration(Date.from(Instant.now().plusSeconds(300)))
                    .signWith(
                        Keys.hmacShaKeyFor(
                            "production-course-test-secret-at-least-32-bytes".getBytes(StandardCharsets.UTF_8)
                        ),
                        Jwts.SIG.HS256
                    )
                    .compact()
        );
        return client.send(
            builder.method(method, HttpRequest.BodyPublishers.noBody()).build(),
            HttpResponse.BodyHandlers.ofString()
        );
    }

    @Test
    void searchFiltersInDatabaseAndReturnsCorrectTotalsAndPages() throws Exception {
        var category = category();
        String marker = UUID.randomUUID().toString();
        course(category, marker + " A", 100, 4.5);
        course(category, marker + " B", 200, 4.2);
        course(category, marker + " C", 500, 5);
        course(category, marker + " D", 50, 2);
        var response = request(
            "/courses?keyword=" +
                marker +
                "&minPrice=100&maxPrice=300&minRating=4&size=1&page=1&sort=price_asc",
            "GET",
            null
        );
        assertThat(response.statusCode()).isEqualTo(200);
        var data = mapper.readTree(response.body()).get("data");
        assertThat(data.get("totalElements").asLong()).isEqualTo(2);
        assertThat(data.get("totalPages").asInt()).isEqualTo(2);
        assertThat(data.get("content").get(0).get("title").asString()).isEqualTo(marker + " B");
        assertThat(request("/courses?minPrice=300&maxPrice=100", "GET", null).statusCode()).isEqualTo(400);
        assertThat(request("/courses?minRating=NaN", "GET", null).statusCode()).isEqualTo(400);
    }

    @Test
    void archiveAndCategoryHideKeepCourseRowsAndAdminCanReadDrafts() throws Exception {
        var category = category();
        var course = course(category, "Preserved course", 100, 0);
        assertThat(
            request("/admin/categories/" + category.getId(), "DELETE", "ADMIN").statusCode()
        ).isEqualTo(200);
        assertThat(categories.findById(category.getId()).orElseThrow().isActive()).isFalse();
        assertThat(courses.existsById(course.getId())).isTrue();
        assertThat(request("/admin/courses/" + course.getId(), "DELETE", "ADMIN").statusCode()).isEqualTo(
            200
        );
        assertThat(courses.findById(course.getId()).orElseThrow().getStatus()).isEqualTo(
            CourseStatus.ARCHIVED
        );
        assertThat(request("/courses/" + course.getId(), "GET", null).statusCode()).isEqualTo(404);
        assertThat(request("/admin/courses/" + course.getId(), "GET", "ADMIN").statusCode()).isEqualTo(200);
        assertThat(request("/admin/courses/" + course.getId(), "GET", "USER").statusCode()).isEqualTo(403);
    }
}
