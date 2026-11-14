package com.elearning.ai;

import static org.assertj.core.api.Assertions.*;

import com.elearning.ai.common.exception.AppException;
import com.elearning.ai.provider.AiProviderProperties;
import com.elearning.ai.provider.GeminiGateway;
import com.elearning.ai.service.AiConversationStore;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.datasource.url=${AI_TEST_DB_URL:jdbc:h2:mem:ai-chat;MODE=MySQL;DB_CLOSE_DELAY=-1}",
        "spring.datasource.username=${AI_TEST_DB_USERNAME:sa}",
        "spring.datasource.password=${AI_TEST_DB_PASSWORD:}",
        "spring.datasource.driver-class-name=${AI_TEST_DB_DRIVER:org.h2.Driver}",
        "security.jwt.secret=ai-integration-test-secret-at-least-32-bytes",
        "integrations.ai.api-key=test-key-never-expose",
        "integrations.ai.model=test-model",
        "integrations.ai.request-timeout-ms=1000",
        "logging.level.root=WARN",
    }
)
@ActiveProfiles("test")
@Import(AiChatIntegrationTests.ProviderConfiguration.class)
class AiChatIntegrationTests {

    private static final String SECRET = "ai-integration-test-secret-at-least-32-bytes";
    private static final String BASE = "/api/v1/ai/conversations";
    private static final AtomicInteger providerStatus = new AtomicInteger(200);
    private static final AtomicInteger contextStatus = new AtomicInteger(200);
    private static final AtomicInteger calls = new AtomicInteger();
    private static final AtomicLong delay = new AtomicLong();
    private static final AtomicReference<String> providerRequest = new AtomicReference<>();
    private static final AtomicReference<String> providerBody = new AtomicReference<>();
    private static final AtomicReference<String> contextSections = new AtomicReference<>();
    private static final AtomicReference<String> providerKey = new AtomicReference<>();
    private static final AtomicReference<String> forwardedAuthorization = new AtomicReference<>();
    private static final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private static final HttpServer stub = server();

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper mapper;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    AiProviderProperties properties;

    @Autowired
    AiConversationStore store;

    private final HttpClient client = HttpClient.newHttpClient();

    @DynamicPropertySource
    static void upstreams(DynamicPropertyRegistry registry) {
        registry.add("course.service-url", () -> "http://127.0.0.1:" + stub.getAddress().getPort());
        registry.add("learning.service-url", () -> "http://127.0.0.1:" + stub.getAddress().getPort());
    }

    @TestConfiguration
    static class ProviderConfiguration {

        @Bean
        @Primary
        GeminiGateway testGateway(AiProviderProperties properties) {
            return new GeminiGateway(properties, "http://127.0.0.1:" + stub.getAddress().getPort());
        }
    }

    private static HttpServer server() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.setExecutor(executor);
            server.createContext("/", exchange -> {
                String path = exchange.getRequestURI().getPath();
                int status = 200;
                String body;
                if (path.startsWith("/v1beta/models/")) {
                    calls.incrementAndGet();
                    providerKey.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
                    providerRequest.set(
                        new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)
                    );
                    try {
                        Thread.sleep(delay.get());
                    } catch (InterruptedException exception) {
                        Thread.currentThread().interrupt();
                    }
                    status = providerStatus.get();
                    body =
                        providerBody.get() != null
                            ? providerBody.get()
                            : status == 200
                              ? """
                                {"candidates":[{"finishReason":"STOP","content":{"parts":[
                                  {"text":"hidden thought","thought":true},{"text":"A clear explanation."}]}}],
                                  "usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":7}}
                                """
                              : "{\"error\":{\"message\":\"upstream-sensitive-test-key-never-expose\"}}";
                } else {
                    forwardedAuthorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
                    status = contextStatus.get();
                    body = switch (path) {
                        case "/api/v1/learning/courses/42" -> "{\"success\":true,\"data\":{\"courseId\":42}}";
                        case "/api/v1/courses/42" -> "{\"success\":true,\"data\":{\"id\":42,\"status\":\"PUBLISHED\",\"title\":\"English course\",\"description\":\"Grammar\"}}";
                        case "/api/v1/courses/42/sections" -> contextSections.get() != null
                            ? contextSections.get()
                            : """
                              {"success":true,"data":[{"id":3,"courseId":42,"lessons":[
                                {"id":9,"sectionId":3,"title":"Past tense","content":"Use past tense for past events.",
                                 "videoUrl":"private-signed-ticket","email":"private@example.com"}]}]}
                              """;
                        default -> "{\"success\":false}";
                    };
                }
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                try {
                    exchange.sendResponseHeaders(status, bytes.length);
                    exchange.getResponseBody().write(bytes);
                } finally {
                    exchange.close();
                }
            });
            server.start();
            return server;
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    @BeforeEach
    void reset() {
        jdbc.update("DELETE FROM ai_messages");
        jdbc.update("DELETE FROM ai_usage_logs");
        jdbc.update("DELETE FROM ai_conversations");
        providerStatus.set(200);
        contextStatus.set(200);
        calls.set(0);
        delay.set(0);
        providerBody.set(null);
        contextSections.set(null);
        properties.setApiKey("test-key-never-expose");
        properties.setModel("test-model");
    }

    @AfterAll
    static void close() {
        stub.stop(0);
        executor.shutdownNow();
    }

    private String token(long userId, String role) {
        return Jwts.builder()
            .subject(Long.toString(userId))
            .issuer("sgedu")
            .claim("role", role)
            .claim("tokenType", "access")
            .issuedAt(Date.from(Instant.now().minusSeconds(1)))
            .expiration(Date.from(Instant.now().plusSeconds(300)))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
            .compact();
    }

    private HttpResponse<String> request(String path, String token, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private long create(String body) throws Exception {
        var response = request(BASE, token(1, "USER"), body);
        assertThat(response.statusCode()).isEqualTo(200);
        return mapper.readTree(response.body()).path("data").path("id").asLong();
    }

    private HttpResponse<String> send(long id, String requestId) throws Exception {
        return request(
            BASE + "/" + id + "/messages",
            token(1, "USER"),
            mapper.writeValueAsString(Map.of("content", "Explain this lesson", "requestId", requestId))
        );
    }

    private int count(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    @Test
    void truncatedAnswerIsMarkedInHistoryAndReplayWithoutGeneratingAgain() throws Exception {
        long id = create("{}");
        providerBody.set(
            """
            {"candidates":[{"finishReason":"MAX_TOKENS","content":{"parts":[{"text":"A partial explanation"}]}}],
             "usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":4096}}
            """
        );
        var response = send(id, "truncated-0001");
        assertThat(response.statusCode()).isEqualTo(200);
        JsonNode reply = mapper.readTree(response.body()).path("data");
        assertThat(reply.get(0).path("truncated").asBoolean()).isFalse();
        assertThat(reply.get(1).path("truncated").asBoolean()).isTrue();
        assertThat(reply.get(1).path("content").asString()).isEqualTo("A partial explanation");

        var history = request(BASE + "/" + id + "/messages", token(1, "USER"), null);
        assertThat(
            mapper.readTree(history.body()).path("data").path("content").get(0).path("truncated").asBoolean()
        ).isTrue();
        JsonNode replay = mapper.readTree(send(id, "truncated-0001").body()).path("data");
        assertThat(replay.size()).isEqualTo(2);
        assertThat(replay.get(1).path("id")).isEqualTo(reply.get(1).path("id"));
        assertThat(replay.get(1).path("content")).isEqualTo(reply.get(1).path("content"));
        assertThat(replay.get(1).path("truncated").asBoolean()).isTrue();
        assertThat(calls.get()).isEqualTo(1);
        assertThat(count("ai_messages")).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT outcome FROM ai_usage_logs", String.class)).isEqualTo(
            "TRUNCATED"
        );
    }

    @Test
    void realHttpProviderPersistsBothMessagesAndReplaysWithoutAnotherCall() throws Exception {
        long id = create("{\"userId\":999,\"apiKey\":\"untrusted\"}");
        var response = send(id, "request-0001");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body())
            .contains("A clear explanation.")
            .doesNotContain("hidden thought", "test-key", "apiKey");
        assertThat(send(id, "request-0001").body()).contains("A clear explanation.");
        assertThat(calls.get()).isEqualTo(1);
        assertThat(count("ai_messages")).isEqualTo(2);
        assertThat(count("ai_usage_logs")).isEqualTo(1);
        assertThat(providerKey.get()).isEqualTo("test-key-never-expose");
        JsonNode payload = mapper.readTree(providerRequest.get());
        assertThat(payload.path("contents").size()).isEqualTo(1);
        assertThat(payload.toString()).doesNotContain("userId", "apiKey", "email");
        var history = request(BASE + "/" + id + "/messages", token(1, "USER"), null);
        assertThat(mapper.readTree(history.body()).path("data").path("totalElements").asInt()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT input_tokens FROM ai_usage_logs", Integer.class)).isEqualTo(
            12
        );
        assertThat(send(id, "request-0002").statusCode()).isEqualTo(200);
        assertThat(mapper.readTree(providerRequest.get()).path("contents").size()).isEqualTo(3);
        assertThat(request(BASE + "/" + id + "/messages?size=1", token(1, "USER"), null).body()).contains(
            "\"last\":false"
        );
    }

    @Test
    void ownersAreEnforcedEvenForAdminAndFrontendIdentityIsIgnored() throws Exception {
        long id = create("{\"userId\":2,\"title\":\"Private title\"}");
        assertThat(request(BASE, null, null).statusCode()).isEqualTo(401);
        for (String role : List.of("USER", "ADMIN")) {
            assertThat(request(BASE, token(2, role), null).body()).doesNotContain("Private title");
            assertThat(request(BASE + "/" + id, token(2, role), null).statusCode()).isEqualTo(404);
            assertThat(request(BASE + "/" + id + "/messages", token(2, role), null).statusCode()).isEqualTo(
                404
            );
            assertThat(
                request(
                    BASE + "/" + id + "/messages",
                    token(2, role),
                    "{\"content\":\"stolen\"}"
                ).statusCode()
            ).isEqualTo(404);
        }
        assertThat(calls.get()).isZero();
    }

    @Test
    void missingConfigDisablesGenerationButNeverHidesSavedHistory() throws Exception {
        long id = create("{}");
        assertThat(send(id, "request-0001").statusCode()).isEqualTo(200);
        properties.setApiKey("");
        var capabilities = request("/api/v1/ai/capabilities", token(1, "USER"), null);
        assertThat(capabilities.body()).contains("\"available\":false", "\"historyAvailable\":true");
        assertThat(request(BASE + "/" + id + "/messages", token(1, "USER"), null).body()).contains(
            "A clear explanation."
        );
        assertThat(send(id, "request-0002").statusCode()).isEqualTo(503);
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void quotaAndConfigurationErrorsAreSafeAndRetryDoesNotDuplicateMessages() throws Exception {
        long id = create("{}");
        for (int status : new int[] { 429, 403, 503 }) {
            providerStatus.set(status);
            var response = send(id, "request-retry");
            assertThat(response.statusCode()).isEqualTo(status == 429 ? 429 : 503);
            assertThat(response.body())
                .contains(
                    status == 429
                        ? "AI_QUOTA_EXCEEDED"
                        : status == 403
                          ? "AI_CONFIGURATION_ERROR"
                          : "AI_PROVIDER_ERROR"
                )
                .doesNotContain("upstream-sensitive", "test-key");
            assertThat(count("ai_messages")).isZero();
        }
        providerStatus.set(200);
        assertThat(send(id, "request-retry").statusCode()).isEqualTo(200);
        assertThat(count("ai_messages")).isEqualTo(2);
        assertThat(count("ai_usage_logs")).isEqualTo(4);
        assertThat(calls.get()).isEqualTo(4);
    }

    @Test
    void actualNetworkTimeoutClearsLeaseAndRetainsRetryableTurn() throws Exception {
        long id = create("{}");
        delay.set(1500);
        var response = send(id, "request-timeout");
        assertThat(response.statusCode()).isEqualTo(504);
        assertThat(response.body()).contains("AI_TIMEOUT");
        assertThat(count("ai_messages")).isZero();
        delay.set(0);
        assertThat(send(id, "request-timeout").statusCode()).isEqualTo(200);
        assertThat(count("ai_messages")).isEqualTo(2);
    }

    @Test
    void concurrentQuestionsAreSerializedWithoutHoldingAnHttpTransaction() throws Exception {
        long id = create("{}");
        delay.set(600);
        var first = CompletableFuture.supplyAsync(() -> {
            try {
                return send(id, "request-concurrent");
            } catch (Exception exception) {
                throw new CompletionException(exception);
            }
        });
        long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        while (calls.get() == 0 && System.nanoTime() < until) Thread.sleep(10);
        assertThat(send(id, "request-concurrent").statusCode()).isEqualTo(409);
        assertThat(first.get(5, TimeUnit.SECONDS).statusCode()).isEqualTo(200);
        assertThat(send(id, "request-concurrent").statusCode()).isEqualTo(200);
        assertThat(calls.get()).isEqualTo(1);
        assertThat(count("ai_messages")).isEqualTo(2);
    }

    @Test
    void authorizedContextIsRevalidatedAndNeverForwardsMediaOrIdentity() throws Exception {
        long id = create("{\"courseId\":42,\"lessonId\":9}");
        assertThat(send(id, "request-context").statusCode()).isEqualTo(200);
        assertThat(forwardedAuthorization.get()).startsWith("Bearer ");
        assertThat(providerRequest.get())
            .contains("Past tense", "Use past tense")
            .contains("understand code", "multiple-choice questions", "learner's language")
            .doesNotContain("private-signed-ticket", "private@example.com");
        contextStatus.set(403);
        assertThat(send(id, "request-revoked").statusCode()).isEqualTo(403);
        assertThat(calls.get()).isEqualTo(1);
        assertThat(
            request(BASE, token(1, "USER"), "{\"courseId\":42,\"lessonId\":99}").statusCode()
        ).isEqualTo(403);
        contextStatus.set(200);
        assertThat(
            request(BASE, token(1, "USER"), "{\"courseId\":42,\"lessonId\":99}").statusCode()
        ).isEqualTo(404);
        assertThat(request(BASE, token(1, "USER"), "{\"lessonId\":9}").statusCode()).isEqualTo(400);
        contextStatus.set(503);
        assertThat(send(id, "request-outage").statusCode()).isEqualTo(503);
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void missingOrTruncatedLessonTextIsExplicitWithoutFetchingMedia() throws Exception {
        for (String content : List.of("   ", "A".repeat(10001))) {
            contextSections.set(
                mapper.writeValueAsString(
                    Map.of(
                        "success",
                        true,
                        "data",
                        List.of(
                            Map.of(
                                "id",
                                3,
                                "courseId",
                                42,
                                "lessons",
                                List.of(
                                    Map.of(
                                        "id",
                                        9,
                                        "sectionId",
                                        3,
                                        "title",
                                        "Lesson with limited text",
                                        "content",
                                        content,
                                        "videoUrl",
                                        "private-media-link"
                                    )
                                )
                            )
                        )
                    )
                )
            );
            long id = create("{\"courseId\":42,\"lessonId\":9}");
            assertThat(send(id, "request-limited-text").statusCode()).isEqualTo(200);
            String instruction = mapper
                .readTree(providerRequest.get())
                .path("systemInstruction")
                .path("parts")
                .path(0)
                .path("text")
                .asString();
            assertThat(instruction)
                .contains("instead of inventing a full lesson summary")
                .doesNotContain("private-media-link", "A".repeat(10001));
            if (content.isBlank()) {
                assertThat(instruction).contains("[No lesson text is available.");
            } else {
                assertThat(instruction)
                    .contains("A".repeat(10000))
                    .contains("[Lesson text truncated; the remainder is not provided.]");
            }
        }
        assertThat(calls.get()).isEqualTo(2);
    }

    @Test
    void requestIdCannotBeReusedForADifferentQuestionAndInputsAreValidated() throws Exception {
        long id = create("{}");
        assertThat(send(id, "request-validate").statusCode()).isEqualTo(200);
        var conflict = request(
            BASE + "/" + id + "/messages",
            token(1, "USER"),
            "{\"content\":\"changed\",\"requestId\":\"request-validate\"}"
        );
        assertThat(conflict.statusCode()).isEqualTo(409);
        for (String content : List.of("   ", "x".repeat(4001))) {
            assertThat(
                request(
                    BASE + "/" + id + "/messages",
                    token(1, "USER"),
                    mapper.writeValueAsString(Map.of("content", content))
                ).statusCode()
            ).isEqualTo(400);
        }
        assertThat(
            request(
                BASE + "/" + id + "/messages",
                token(1, "USER"),
                "{\"content\":\"x\",\"requestId\":\"../bad\"}"
            ).statusCode()
        ).isEqualTo(400);
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void blockedOrMalformedProviderResponsesNeverBecomeFakeAnswers() throws Exception {
        long id = create("{}");
        for (String body : List.of(
            "{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}",
            "{\"candidates\":[{\"finishReason\":\"SAFETY\",\"content\":{\"parts\":[{\"text\":\"blocked text\"}]}}]}"
        )) {
            providerBody.set(body);
            var response = send(id, "request-blocked");
            assertThat(response.statusCode()).isEqualTo(422);
            assertThat(response.body()).contains("AI_CONTENT_BLOCKED").doesNotContain("blocked text");
        }
        for (String body : List.of(
            "{}",
            "not JSON",
            "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\" \"}]}}]}"
        )) {
            providerBody.set(body);
            assertThat(send(id, "request-blocked").statusCode()).isEqualTo(503);
        }
        assertThat(count("ai_messages")).isZero();
    }

    @Test
    void expiredLeaseCannotUnlockOrCommitOverANewerAttempt() throws Exception {
        long id = create("{}");
        var old = store.reserve(1L, id, "request-lease", "Question");
        jdbc.update("UPDATE ai_conversations SET active_until = ? WHERE id = ?", statement -> {
            statement.setTimestamp(
                1,
                Timestamp.from(Instant.now().minusSeconds(1)),
                Calendar.getInstance(TimeZone.getTimeZone("UTC"))
            );
            statement.setLong(2, id);
        });
        var next = store.reserve(1L, id, "request-lease", "Question");
        assertThat(next.leaseId()).isNotEqualTo(old.leaseId());
        store.fail(1L, id, old.leaseId(), "test-model", "AI_TIMEOUT");
        assertThat(
            jdbc.queryForObject(
                "SELECT active_request_id FROM ai_conversations WHERE id = ?",
                String.class,
                id
            )
        ).isEqualTo(next.leaseId());
        assertThatThrownBy(() ->
            store.finish(
                1L,
                id,
                "request-lease",
                old.leaseId(),
                "Question",
                new GeminiGateway.Reply("Old answer", 1, 1),
                "test-model"
            )
        ).isInstanceOf(AppException.class);
        store.finish(
            1L,
            id,
            "request-lease",
            next.leaseId(),
            "Question",
            new GeminiGateway.Reply("New answer", 1, 1),
            "test-model"
        );
        assertThat(count("ai_messages")).isEqualTo(2);
        assertThat(calls.get()).isZero();
    }
}
