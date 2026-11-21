package com.elearning.learning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.service.ToeicS3MediaStorage;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(properties = { "toeic.seed.enabled=false", "logging.level.root=WARN" })
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ToeicMediaIntegrationTests {

    private static final String SECRET = UUID.randomUUID().toString() + UUID.randomUUID();
    private static final String ADMIN = "/api/v1/learning/admin/toeic/media";
    private static final String EXAMS = "/api/v1/learning/admin/toeic/exams";
    private static final URI SIGNED = URI.create("https://example-media.s3.amazonaws.com/temporary-audio");
    private static final byte[] PNG = Base64.getDecoder().decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XWioAAAAASUVORK5CYII="
    );

    @TempDir
    static Path uploads;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry properties) {
        properties.add("security.jwt.secret", () -> SECRET);
        properties.add("spring.datasource.url", () -> "jdbc:h2:mem:toeicMedia;MODE=MySQL;DB_CLOSE_DELAY=-1");
        properties.add("toeic.media.local-dir", () -> uploads.toString());
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper mapper;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    ToeicS3MediaStorage cloud;

    @Test
    void adminsCanManageLocalAudioAndThePlaybackUrlSupportsRanges() throws Exception {
        mvc.perform(get(ADMIN)).andExpect(status().isUnauthorized());
        upload("USER", "clip.mp3", audio(), "AUDIO").andExpect(status().isForbidden());
        upload("ADMIN", "invalid.mp3", new byte[] { 1, 2, 3 }, "AUDIO").andExpect(status().isBadRequest());
        upload("ADMIN", "wrong-type.png", PNG, "AUDIO").andExpect(status().isBadRequest());

        JsonNode asset = created("clip.mp3", audio(), "AUDIO");
        String id = id(asset);
        String url = asset.path("url").asText();
        mvc.perform(
            get(ADMIN).param("kind", "AUDIO").param("size", "1").header("Authorization", auth("ADMIN"))
        )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.cloudEnabled").value(false))
            .andExpect(jsonPath("$.data.assets.content[0].id").value(id))
            .andExpect(jsonPath("$.data.assets.content[0].cloudCopy").value(false));
        mvc.perform(get(ADMIN).param("size", "51").header("Authorization", auth("ADMIN"))).andExpect(
            status().isBadRequest()
        );
        mvc.perform(get(url).header("Range", "bytes=0-3"))
            .andExpect(status().isPartialContent())
            .andExpect(header().string("Content-Type", "audio/mpeg"))
            .andExpect(content().bytes(Arrays.copyOf(audio(), 4)));
        mvc.perform(head(url))
            .andExpect(status().isOk())
            .andExpect(header().longValue("Content-Length", audio().length));

        JsonNode updated = data(
            mvc
                .perform(
                    multipart(HttpMethod.PUT, ADMIN + "/" + id)
                        .file(new MockMultipartFile("file", "clip-v2.mp3", "audio/mpeg", audio()))
                        .param("version", "1")
                        .header("Authorization", auth("ADMIN"))
                )
                .andExpect(status().isOk())
        );
        assertThat(updated.path("url").asText()).isEqualTo(url);
        assertThat(updated.path("version").asLong()).isEqualTo(2);
        remove(asset).andExpect(status().isConflict());
        remove(updated).andExpect(status().isNoContent());
        mvc.perform(get(url)).andExpect(status().isNotFound());
        verify(cloud, never()).put(anyString(), any(), anyString());
    }

    @Test
    void cloudCopiesAreWrittenReadAsFallbackReplacedAndDeleted() throws Exception {
        when(cloud.enabled()).thenReturn(true);
        Map<String, byte[]> copies = new HashMap<>();
        doAnswer(call -> {
            copies.put(call.getArgument(0), Files.readAllBytes(call.getArgument(1)));
            return null;
        })
            .when(cloud)
            .put(anyString(), any(), eq("image/png"));
        doAnswer(call -> {
            copies.remove(call.getArgument(0));
            return null;
        })
            .when(cloud)
            .delete(anyString());

        JsonNode asset = created("picture.png", PNG, "IMAGE");
        String url = asset.path("url").asText();
        String originalKey = key(id(asset));
        assertThat(asset.path("cloudCopy").asBoolean()).isTrue();
        assertThat(copies.get(originalKey)).isEqualTo(PNG);
        assertThat(Files.readAllBytes(uploads.resolve(originalKey))).isEqualTo(PNG);
        mvc.perform(get(url)).andExpect(status().isOk()).andExpect(content().bytes(PNG));
        verify(cloud, never()).preview(anyString());

        JsonNode updated = data(
            mvc
                .perform(
                    multipart(HttpMethod.PUT, ADMIN + "/" + id(asset))
                        .file(new MockMultipartFile("file", "picture-new.png", "image/png", PNG))
                        .param("version", "1")
                        .header("Authorization", auth("ADMIN"))
                )
                .andExpect(status().isOk())
        );
        String newKey = key(id(asset));
        assertThat(newKey).isNotEqualTo(originalKey);
        assertThat(copies).containsOnlyKeys(newKey);
        assertThat(Files.exists(uploads.resolve(originalKey))).isFalse();

        Files.delete(uploads.resolve(newKey));
        when(cloud.size(newKey)).thenReturn((long) PNG.length);
        when(cloud.preview(newKey)).thenReturn(SIGNED);
        mvc.perform(get(url))
            .andExpect(status().isTemporaryRedirect())
            .andExpect(redirectedUrl(SIGNED.toString()));
        mvc.perform(head(url))
            .andExpect(status().isOk())
            .andExpect(header().longValue("Content-Length", PNG.length));
        when(cloud.enabled()).thenReturn(false);
        mvc.perform(get(url)).andExpect(status().isNotFound());
        remove(updated).andExpect(status().isServiceUnavailable());
        when(cloud.enabled()).thenReturn(true);
        remove(updated).andExpect(status().isNoContent());
        assertThat(copies).isEmpty();
    }

    @Test
    void anS3WriteFailureDoesNotPublishAnAssetOrKeepItsLocalFile() throws Exception {
        when(cloud.enabled()).thenReturn(true);
        doThrow(new AppException(ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE))
            .when(cloud)
            .put(anyString(), any(), anyString());
        upload("ADMIN", "unavailable.png", PNG, "IMAGE").andExpect(status().isServiceUnavailable());
        assertThat(
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM toeic_media WHERE original_name = 'unavailable.png'",
                Integer.class
            )
        ).isZero();
        var file = org.mockito.ArgumentCaptor.forClass(Path.class);
        verify(cloud).put(anyString(), file.capture(), eq("image/png"));
        assertThat(Files.exists(file.getValue())).isFalse();
    }

    @Test
    void aPublishedAdminTestKeepsTheSameMediaThroughTheLearnerAttemptAndResult() throws Exception {
        JsonNode audio = created("linked.mp3", audio(), "AUDIO");
        JsonNode image = created("linked.png", PNG, "IMAGE");
        postExam(image.path("url").asText()).andExpect(status().isBadRequest());
        JsonNode exam = data(postExam(audio.path("url").asText()).andExpect(status().isCreated()));
        long examId = exam.path("id").asLong();
        String detail = "/api/v1/learning/toeic/exams/" + examId;
        String mediaUrl = audio.path("url").asText();
        remove(audio)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("TOEIC_MEDIA_IN_USE"));
        mvc.perform(get(detail).header("Authorization", auth("USER"))).andExpect(status().isNotFound());
        mvc.perform(
            patch(EXAMS + "/" + examId + "/publish")
                .header("Authorization", auth("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"published\":true}")
        )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.published").value(true));
        mvc.perform(get("/api/v1/learning/toeic/exams"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].id").value(examId))
            .andExpect(jsonPath("$.data[0].section").value("LISTENING"))
            .andExpect(jsonPath("$.data[0].questionCount").value(1))
            .andExpect(jsonPath("$.data[0].durationMinutes").value(12));
        mvc.perform(get(detail).header("Authorization", auth("USER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.questions[0].listening.audioUrl").value(mediaUrl))
            .andExpect(jsonPath("$.data.questions[0].listening.transcript").doesNotExist());
        JsonNode attempt = data(
            mvc
                .perform(
                    post(detail + "/attempts")
                        .header("Authorization", auth("USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"EXAM\"}")
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[0].correctOptionId").doesNotExist())
                .andExpect(jsonPath("$.data.questions[0].listening.audioUrl").value(mediaUrl))
                .andExpect(jsonPath("$.data.durationMinutes").value(12))
        );
        mvc.perform(
            post("/api/v1/learning/toeic/attempts/" + attempt.path("id").asLong() + "/submit")
                .header("Authorization", auth("USER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"answers\":{\"q7\":\"B\"}}")
        )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.score").value(100))
            .andExpect(jsonPath("$.data.questions[0].correctOptionId").value("B"))
            .andExpect(jsonPath("$.data.questions[0].listening.audioUrl").value(mediaUrl))
            .andExpect(
                jsonPath("$.data.questions[0].listening.transcript").value("Sample listening transcript.")
            );
        mvc.perform(delete(EXAMS + "/" + examId).header("Authorization", auth("ADMIN"))).andExpect(
            status().isNoContent()
        );
        remove(audio)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("TOEIC_MEDIA_IN_USE"));
        remove(image).andExpect(status().isNoContent());
    }

    private ResultActions postExam(String audioUrl) throws Exception {
        return mvc.perform(
            post(EXAMS)
                .header("Authorization", auth("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"slug":"media-listening","title":"Media Listening","durationMinutes":12,"published":false,"lessons":[],"questions":[
                      {"id":"q7","number":7,"part":2,"prompt":"","options":[{"id":"A","text":""},{"id":"B","text":""},{"id":"C","text":""}],
                        "correctOptionId":"B","listening":{"audioUrl":"%s","transcript":"Sample listening transcript."}}
                    ]}
                    """.formatted(audioUrl)
                )
        );
    }

    private JsonNode created(String name, byte[] bytes, String kind) throws Exception {
        return data(upload("ADMIN", name, bytes, kind).andExpect(status().isCreated()));
    }

    private ResultActions upload(String role, String name, byte[] bytes, String kind) throws Exception {
        return mvc.perform(
            multipart(ADMIN)
                .file(new MockMultipartFile("file", name, "application/octet-stream", bytes))
                .param("kind", kind)
                .header("Authorization", auth(role))
        );
    }

    private ResultActions remove(JsonNode asset) throws Exception {
        return mvc.perform(
            delete(ADMIN + "/" + id(asset))
                .param("version", asset.path("version").asText())
                .header("Authorization", auth("ADMIN"))
        );
    }

    private String key(String id) {
        return jdbc.queryForObject("SELECT object_key FROM toeic_media WHERE id = ?", String.class, id);
    }

    private JsonNode data(ResultActions response) throws Exception {
        return mapper.readTree(response.andReturn().getResponse().getContentAsString()).path("data");
    }

    private String id(JsonNode asset) {
        return asset.path("id").asText();
    }

    private String auth(String role) {
        return (
            "Bearer " +
            Jwts.builder()
                .subject("981001")
                .issuer("sgedu")
                .claim("role", role)
                .claim("tokenType", "access")
                .issuedAt(Date.from(Instant.now().minusSeconds(1)))
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
                .compact()
        );
    }

    private static byte[] audio() {
        byte[] bytes = new byte[192 * 64];
        for (int offset = 0; offset < bytes.length; offset += 192) {
            bytes[offset] = (byte) 0xff;
            bytes[offset + 1] = (byte) 0xfb;
            bytes[offset + 2] = 0x54;
            bytes[offset + 3] = (byte) 0xc0;
        }
        return bytes;
    }
}
