package com.elearning.course;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.integration.storage.*;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

class StorageIntegrationTests {
    @TempDir Path directory;

    @Test
    void localTicketsRequireTheConfiguredSecretAndRejectTamperingAndExpiration() {
        var storage = new LocalStorageService(directory.toString(), "test-secret-one");
        String url = storage.generatePresignedUrl("videos/lesson.mp4", Duration.ofMinutes(5));
        Map<String, String> query = new HashMap<>();
        for (String part : URI.create(url).getQuery().split("&")) {
            String[] pair = part.split("=", 2); query.put(pair[0], pair[1]);
        }
        long expires = Long.parseLong(query.get("expires"));
        String token = query.get("token");
        assertThat(storage.verifySignedToken("videos/lesson.mp4", expires, token)).isTrue();
        assertThat(new LocalStorageService(directory.toString(), "test-secret-two").verifySignedToken("videos/lesson.mp4", expires, token)).isFalse();
        assertThat(storage.verifySignedToken("videos/other.mp4", expires, token)).isFalse();
        assertThat(storage.verifySignedToken("videos/lesson.mp4", expires + 1, token)).isFalse();
        assertThat(storage.verifySignedToken("videos/lesson.mp4", 0L, token)).isFalse();
        assertThat(storage.verifySignedToken("videos/lesson.mp4", null, token)).isFalse();
        assertThat(storage.verifySignedToken("videos/lesson.mp4", expires, null)).isFalse();
        assertThat(storage.generatePresignedUrl("videos/a.mp4", null)).contains("&token=");
    }

    @Test
    void localStorageRejectsEscapesWithoutReadingOrDeletingOutsideTheUploadDirectory() throws Exception {
        Path outside = directory.resolve("keep.txt"); Files.writeString(outside, "keep");
        var storage = new LocalStorageService(directory.resolve("uploads").toString());
        for (String key : Arrays.asList("../keep.txt", outside.toString(), ".", "", null)) {
            assertThatThrownBy(() -> storage.loadAsResource(key)).isInstanceOf(AppException.class);
            assertThatThrownBy(() -> storage.delete(key)).isInstanceOf(AppException.class);
        }
        assertThat(Files.readString(outside)).isEqualTo("keep");
        assertThatThrownBy(() -> storage.loadAsResource("missing.txt")).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> new LocalStorageService(outside.toString())).isInstanceOf(AppException.class);
    }

    @Test
    void localUploadHandlesMissingNamesAndRejectsEmptyOrUnreadableStreams() throws Exception {
        var storage = new LocalStorageService(directory.toString());
        var uploaded = storage.upload(new MockMultipartFile("file", "", "text/plain", new byte[]{1}), null);
        assertThat(uploaded.objectKey()).startsWith("media/");
        assertThat(storage.loadAsResource(uploaded.objectKey()).contentLength()).isEqualTo(1);
        assertThatThrownBy(() -> storage.upload(new MockMultipartFile("file", new byte[0]), "docs")).isInstanceOf(AppException.class);
        MultipartFile broken = mock(MultipartFile.class);
        when(broken.getInputStream()).thenThrow(new IOException("test read failure"));
        assertThatThrownBy(() -> storage.upload(broken, "docs")).isInstanceOf(AppException.class);
    }

    @Test
    void s3UploadsAndDeletesUseTheConfiguredBucketAndNeverAcceptUnsignedBackendDownloads() throws Exception {
        var status = new AtomicInteger(200);
        var methods = new ArrayList<String>();
        var paths = new ArrayList<String>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            synchronized (methods) { methods.add(exchange.getRequestMethod()); paths.add(exchange.getRequestURI().getPath()); }
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(status.get(), -1); exchange.close();
        });
        server.start();
        try {
            String endpoint = "http://127.0.0.1:" + server.getAddress().getPort();
            var storage = new AwsS3StorageService("test-bucket", "us-east-1", "test-key", "test-secret", endpoint, true, "");
            var upload = storage.upload(new MockMultipartFile("file", "notes.pdf", "application/pdf", new byte[]{1,2,3}), "../docs");
            assertThat(upload.objectKey()).startsWith("docs/").endsWith(".pdf");
            assertThat(upload.url()).contains("test-bucket", "X-Amz-Signature=");
            storage.delete(upload.objectKey());
            assertThat(methods).containsExactly("PUT", "DELETE");
            assertThat(paths).allMatch(path -> path.startsWith("/test-bucket/docs/"));
            assertThat(storage.getDownloadUrl("docs/a.pdf")).contains("X-Amz-Signature=");
            assertThat(storage.generatePresignedUrl("docs/a.pdf", null)).contains("X-Amz-Expires=3600");
            assertThat(storage.verifySignedToken("docs/a.pdf", Long.MAX_VALUE, "forged")).isFalse();
            assertThatThrownBy(() -> storage.loadAsResource("docs/a.pdf")).isInstanceOf(AppException.class);
            for (String key : Arrays.asList(null, "", " ")) {
                assertThatThrownBy(() -> storage.delete(key)).isInstanceOf(AppException.class);
                assertThatThrownBy(() -> storage.generatePresignedUrl(key, null)).isInstanceOf(AppException.class);
            }
            status.set(400);
            assertThatThrownBy(() -> storage.delete("docs/a.pdf")).isInstanceOf(AppException.class);
            assertThatThrownBy(() -> storage.upload(new MockMultipartFile("file", new byte[]{1}), null)).isInstanceOf(AppException.class);
            MultipartFile broken = mock(MultipartFile.class);
            when(broken.getInputStream()).thenThrow(new IOException("read failure"));
            assertThatThrownBy(() -> storage.upload(broken, null)).isInstanceOf(AppException.class);
        } finally { server.stop(0); }
    }

    @Test
    void missingS3ConfigurationAndEmptyUploadsFailBeforeNetworkRequests() {
        var storage = new AwsS3StorageService("", "", "", "", "", false, "");
        assertThat(storage.getPublicEndpointUrl()).isEmpty();
        assertThat(storage.isPathStyleEnabled()).isFalse();
        assertThatThrownBy(() -> storage.upload(new MockMultipartFile("file", new byte[0]), null)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> storage.upload(new MockMultipartFile("file", new byte[]{1}), null)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> storage.delete("docs/a.pdf")).isInstanceOf(AppException.class);
    }
}
