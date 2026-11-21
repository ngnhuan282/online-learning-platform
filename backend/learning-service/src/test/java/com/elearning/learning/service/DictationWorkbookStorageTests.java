package com.elearning.learning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

class DictationWorkbookStorageTests {

    @Test
    void cloudCreatesReadsAndReplacesSingleWorkbookDirectlyInConfiguredPrefix(@TempDir Path local) throws Exception {
        String key = "documents/transcripts/bai-nghe-so-1-12345678.xlsx";
        var saved = new AtomicReference<byte[]>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chitchatgo-media/", exchange -> {
            try (exchange) {
                String path = exchange.getRequestURI().getPath();
                if (path.endsWith("/missing.xlsx")) {
                    byte[] body = "<Error><Code>NoSuchKey</Code></Error>".getBytes();
                    exchange.sendResponseHeaders(404, body.length);
                    exchange.getResponseBody().write(body);
                    return;
                }
                if (path.endsWith("/oversized.xlsx")) {
                    byte[] body = new byte[DictationWorkbookService.MAX_WORKBOOK_BYTES + 1];
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body);
                    return;
                }
                switch (exchange.getRequestMethod()) {
                    case "PUT" -> {
                        saved.set(exchange.getRequestBody().readAllBytes());
                        exchange.sendResponseHeaders(200, -1);
                    }
                    case "GET" -> {
                        byte[] contents = saved.get();
                        exchange.sendResponseHeaders(200, contents.length);
                        exchange.getResponseBody().write(contents);
                    }
                    default -> exchange.sendResponseHeaders(405, -1);
                }
            }
        });
        server.start();
        try (S3Client s3 = S3Client.builder()
            .region(Region.US_EAST_1)
            .endpointOverride(URI.create("http://127.0.0.1:" + server.getAddress().getPort()))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build())
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("test-key", "test-secret")))
            .build()) {
            var provider = new StaticListableBeanFactory(Map.of("s3", s3)).getBeanProvider(S3Client.class);
            var storage = new DictationWorkbookStorage(
                provider, "s3", local.toString(), "chitchatgo-media", "documents/transcripts/"
            );
            String generated = storage.suggestedKey("12345678-abcd-ef00-0000-000000000000", "Bài nghe số 1!", false);
            assertThat(generated).isEqualTo(key);
            assertThat(generated).doesNotContain("_admin");
            String longTitle = "Very long lesson title that definitely exceeds sixty characters in length for slug testing";
            assertThat(storage.suggestedKey("12345678-abcd-ef00-0000-000000000000", longTitle, true))
                .endsWith("-12345678-abcd-ef00-0000-000000000000.xlsx");

            storage.write(generated, new byte[] {1});
            assertThat(storage.read(generated)).containsExactly(1);
            storage.write(generated, new byte[] {2, 3});
            assertThat(storage.read(generated)).containsExactly(2, 3);
            assertThat(storage.read("documents/transcripts/missing.xlsx")).isNull();
            assertThatThrownBy(() -> storage.read("documents/transcripts/oversized.xlsx"))
                .isInstanceOf(IOException.class);
            assertThat(local.resolve("workbooks")).doesNotExist();
        } finally {
            server.stop(0);
        }
    }

    @Test
    void localStorageAndS3ConfigurationValidateInputsAndBounds(@TempDir Path local) throws Exception {
        var emptyProvider = new StaticListableBeanFactory().getBeanProvider(S3Client.class);
        assertThatThrownBy(() -> new DictationWorkbookStorage(emptyProvider, "ftp", local.toString(), "", ""))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new DictationWorkbookStorage(emptyProvider, "s3", local.toString(), "b", "p"))
            .isInstanceOf(IllegalArgumentException.class);

        var localStorage = new DictationWorkbookStorage(emptyProvider, "local", local.toString(), "", "");
        assertThat(localStorage.read("missing.xlsx")).isNull();
        assertThatThrownBy(() -> localStorage.read("../escape.xlsx")).isInstanceOf(IOException.class);
        Path oversized = local.resolve("workbooks").resolve("too-big.xlsx");
        Files.createDirectories(oversized.getParent());
        Files.write(oversized, new byte[DictationWorkbookService.MAX_WORKBOOK_BYTES + 1]);
        assertThatThrownBy(() -> localStorage.read("too-big.xlsx")).isInstanceOf(IOException.class);

        var config = new DictationS3Configuration();
        try (
            S3Client endpointClient = config.dictationS3Client("ap-southeast-1", "http://127.0.0.1:9000", false);
            S3Client defaultClient = config.dictationS3Client("ap-southeast-1", "", true)
        ) {
            var s3Provider = new StaticListableBeanFactory(Map.of("s3", defaultClient)).getBeanProvider(S3Client.class);
            assertThatThrownBy(() -> new DictationWorkbookStorage(s3Provider, "s3", local.toString(), "", "documents/"))
                .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> new DictationWorkbookStorage(s3Provider, "s3", local.toString(), "bucket", "/"))
                .isInstanceOf(IllegalArgumentException.class);
            assertThat(config.dictationS3WorkbookImporter(null, endpointClient, "bucket", "documents/transcripts"))
                .isNotNull();
            assertThatThrownBy(() -> config.dictationS3WorkbookImporter(null, endpointClient, "", "documents/"))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
