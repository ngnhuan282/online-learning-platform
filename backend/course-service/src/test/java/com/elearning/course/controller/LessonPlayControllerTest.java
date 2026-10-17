package com.elearning.course.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.LessonPlayResponse;
import com.elearning.course.entity.LessonType;
import com.elearning.course.service.LessonService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class LessonPlayControllerTest {

    static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("security.jwt.secret", () -> SECRET);
    }

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @MockitoBean
    LessonService lessonService;

    HttpClient client = HttpClient.newHttpClient();

    String generateToken(String userId, String role) {
        return Jwts.builder()
            .subject(userId)
            .issuer("learnsphere")
            .claim("role", role)
            .claim("roles", List.of(role))
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(10)))
            .expiration(Date.from(Instant.now().plusSeconds(3600)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    @Test
    void getPlayUrl_preview_guestAllowed_returns200() throws Exception {
        LessonPlayResponse expected = new LessonPlayResponse(
            10L, "Preview Lesson", LessonType.VIDEO, "https://cdn.example.com/preview.mp4", 1800, true, null, 300
        );
        when(lessonService.getPlayUrl(eq(1L), eq(10L), any(), anyBoolean())).thenReturn(expected);

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:" + port + "/api/v1/courses/1/lessons/10/play-url"))
            .GET()
            .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(200);

        JsonNode root = mapper.readTree(resp.body());
        assertThat(root.get("success").asBoolean()).isTrue();
        assertThat(root.get("data").get("playUrl").asString()).isEqualTo("https://cdn.example.com/preview.mp4");
        assertThat(root.get("data").get("preview").asBoolean()).isTrue();
    }

    @Test
    void getPlayUrl_private_guest_returns401() throws Exception {
        when(lessonService.getPlayUrl(eq(1L), eq(20L), any(), anyBoolean()))
            .thenThrow(new AppException(ErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập"));

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:" + port + "/api/v1/courses/1/lessons/20/play-url"))
            .GET()
            .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(401);
    }

    @Test
    void getPlayUrl_private_notEnrolled_returns403() throws Exception {
        String token = generateToken("123", "USER");

        when(lessonService.getPlayUrl(eq(1L), eq(20L), eq(123L), eq(false)))
            .thenThrow(new AppException(ErrorCode.FORBIDDEN, "Bạn cần đăng ký khóa học"));

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:" + port + "/api/v1/courses/1/lessons/20/play-url"))
            .header("Authorization", "Bearer " + token)
            .GET()
            .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(403);
    }

    @Test
    void getPlayUrl_private_enrolled_returns200() throws Exception {
        String token = generateToken("123", "USER");
        LessonPlayResponse expected = new LessonPlayResponse(
            20L, "Private Lesson", LessonType.VIDEO, "https://s3.amazonaws.com/presigned-stream.mp4", 1800, false, null, 600
        );

        when(lessonService.getPlayUrl(eq(1L), eq(20L), eq(123L), eq(false))).thenReturn(expected);

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:" + port + "/api/v1/courses/1/lessons/20/play-url"))
            .header("Authorization", "Bearer " + token)
            .GET()
            .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).isEqualTo(200);

        JsonNode root = mapper.readTree(resp.body());
        assertThat(root.get("success").asBoolean()).isTrue();
        assertThat(root.get("data").get("playUrl").asString()).isEqualTo("https://s3.amazonaws.com/presigned-stream.mp4");
        assertThat(root.get("data").get("preview").asBoolean()).isFalse();
    }
}
