package com.elearning.learning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.retry.RetryPolicy;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/** Exercises the real AWS SDK against an isolated HTTP fixture, without AWS credentials or a bucket. */
class ToeicS3MediaStorageTests {

    private static final String PREFIX = "/fixture-media/documents/TOEIC/uploads/";
    private final Map<String, byte[]> objects = new ConcurrentHashMap<>();
    private final Map<String, String> signedRequests = new ConcurrentHashMap<>();
    private volatile int failureStatus;
    private HttpServer server;
    private ToeicS3MediaStorage storage;

    @TempDir
    Path temporary;

    @BeforeEach
    void startStorage() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::serveObject);
        server.start();
        URI endpoint = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        var credentials = StaticCredentialsProvider.create(
            AwsBasicCredentials.create("fixture-key", "fixture-secret-not-an-aws-credential")
        );
        S3Client client = S3Client.builder()
            .region(Region.AP_SOUTHEAST_1)
            .credentialsProvider(credentials)
            .endpointOverride(endpoint)
            .forcePathStyle(true)
            .overrideConfiguration(config -> config.retryPolicy(RetryPolicy.none()))
            .build();
        S3Presigner presigner = S3Presigner.builder()
            .region(Region.AP_SOUTHEAST_1)
            .credentialsProvider(credentials)
            .endpointOverride(endpoint)
            .build();
        storage = new ToeicS3MediaStorage("fixture-media", "/documents/TOEIC/uploads/", client, presigner);
    }

    @AfterEach
    void stopStorage() {
        if (storage != null) storage.close();
        if (server != null) server.stop(0);
    }

    @Test
    void realSdkCreatesReadsUpdatesAndDeletesWithTheConfiguredCaseSensitivePrefix() throws Exception {
        String key = "clip.mp3";
        Path file = temporary.resolve(key);
        byte[] original = "original audio bytes".getBytes(StandardCharsets.UTF_8);
        Files.write(file, original);

        storage.put(key, file, "audio/mpeg");
        assertThat(objects).containsOnlyKeys(PREFIX + key);
        assertThat(objects.get(PREFIX + key)).isEqualTo(original);
        assertThat(storage.size(key)).isEqualTo(original.length);
        URI preview = storage.preview(key);
        assertThat(preview.getPath()).isEqualTo(PREFIX + key);
        assertThat(preview.getQuery()).contains("X-Amz-Signature=", "X-Amz-Expires=1200");
        try (var browser = HttpClient.newHttpClient()) {
            var result = browser.send(
                HttpRequest.newBuilder(preview).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray()
            );
            assertThat(result.statusCode()).isEqualTo(200);
            assertThat(result.body()).isEqualTo(original);
        }

        byte[] replacement = "replacement audio".getBytes(StandardCharsets.UTF_8);
        Files.write(file, replacement);
        storage.put(key, file, "audio/mpeg");
        assertThat(objects.get(PREFIX + key)).isEqualTo(replacement);
        assertThat(storage.size(key)).isEqualTo(replacement.length);
        storage.delete(key);
        assertThat(objects).isEmpty();
        assertThat(signedRequests.keySet()).contains("PUT", "HEAD", "DELETE");
        assertThat(signedRequests.values()).allSatisfy(value ->
            assertThat(value).startsWith("AWS4-HMAC-SHA256 ")
        );
    }

    @Test
    void missingObjectsAndDeniedCloudOperationsHaveStableApplicationErrors() throws Exception {
        assertThatThrownBy(() -> storage.size("missing.mp3")).isInstanceOfSatisfying(AppException.class, ex ->
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND)
        );
        Path file = Files.writeString(temporary.resolve("clip.mp3"), "audio");
        failureStatus = 403;
        assertStorageUnavailable(() -> storage.put("clip.mp3", file, "audio/mpeg"));
        assertStorageUnavailable(() -> storage.size("clip.mp3"));
        assertStorageUnavailable(() -> storage.delete("clip.mp3"));
        assertThat(objects).isEmpty();
    }

    @Test
    void aBlankBucketDisablesCloudAndCanBeClosedWithoutResolvingCredentials() {
        var disabled = new ToeicS3MediaStorage("  ", "ap-southeast-1", "documents/toeic/uploads/");
        assertThat(disabled.enabled()).isFalse();
        disabled.close();
    }

    @Test
    void configuredStorageStartsWithoutAccessingTheBucketAndRejectsAnEmptyPrefix() {
        var configured = new ToeicS3MediaStorage(
            "fixture-media",
            "ap-southeast-1",
            "documents/TOEIC/uploads"
        );
        assertThat(configured.enabled()).isTrue();
        configured.close();
        assertThat(objects).isEmpty();
        assertThatThrownBy(() ->
            new ToeicS3MediaStorage("fixture-media", "ap-southeast-1", " / ")
        ).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void clientConnectionAndSigningFailuresReturnStorageUnavailable() {
        var client = mock(S3Client.class);
        var presigner = mock(S3Presigner.class);
        var failure = SdkClientException.create("Credentials or connection unavailable");
        doThrow(failure).when(client).headObject(any(java.util.function.Consumer.class));
        doThrow(failure).when(presigner).presignGetObject(any(java.util.function.Consumer.class));
        var unavailable = new ToeicS3MediaStorage(
            "fixture-media",
            "documents/toeic/uploads/",
            client,
            presigner
        );
        assertStorageUnavailable(() -> unavailable.size("clip.mp3"));
        assertStorageUnavailable(() -> unavailable.preview("clip.mp3"));
        unavailable.close();
    }

    private void assertStorageUnavailable(org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action).isInstanceOfSatisfying(AppException.class, ex ->
            assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.TOEIC_MEDIA_STORAGE_UNAVAILABLE)
        );
    }

    private void serveObject(HttpExchange exchange) throws IOException {
        try (exchange) {
            String key = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            if (!key.startsWith(PREFIX)) {
                exchange.sendResponseHeaders(400, -1);
                return;
            }
            if (failureStatus > 0) {
                exchange.sendResponseHeaders(failureStatus, -1);
                return;
            }
            if (!method.equals("GET")) signedRequests.put(
                method,
                exchange.getRequestHeaders().getFirst("Authorization")
            );
            switch (method) {
                case "PUT" -> {
                    byte[] raw = exchange.getRequestBody().readAllBytes();
                    boolean chunked = exchange
                        .getRequestHeaders()
                        .containsKey("x-amz-decoded-content-length");
                    byte[] stored = chunked ? decodeChunks(raw) : raw;
                    objects.put(key, stored);
                    exchange.getResponseHeaders().set("ETag", "\"" + md5(stored) + "\"");
                    exchange.sendResponseHeaders(200, -1);
                }
                case "HEAD" -> {
                    byte[] bytes = objects.get(key);
                    if (bytes != null) exchange
                        .getResponseHeaders()
                        .set("Content-Length", Integer.toString(bytes.length));
                    exchange.sendResponseHeaders(bytes == null ? 404 : 200, -1);
                }
                case "GET" -> {
                    byte[] bytes = objects.get(key);
                    exchange.getResponseHeaders().set("Content-Type", "audio/mpeg");
                    exchange.sendResponseHeaders(
                        bytes == null ? 404 : 200,
                        bytes == null ? -1 : bytes.length
                    );
                    if (bytes != null) exchange.getResponseBody().write(bytes);
                }
                case "DELETE" -> {
                    objects.remove(key);
                    exchange.sendResponseHeaders(204, -1);
                }
                default -> exchange.sendResponseHeaders(405, -1);
            }
        }
    }

    private static byte[] decodeChunks(byte[] raw) {
        var result = new ByteArrayOutputStream();
        for (int offset = 0; offset < raw.length; ) {
            int end = offset;
            while (raw[end] != '\r') end++;
            String header = new String(raw, offset, end - offset, StandardCharsets.US_ASCII);
            int length = Integer.parseInt(header.split(";", 2)[0], 16);
            if (length == 0) break;
            result.write(raw, end + 2, length);
            offset = end + 4 + length;
        }
        return result.toByteArray();
    }

    private static String md5(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("MD5").digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
