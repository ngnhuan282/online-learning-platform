package com.elearning.learning.service;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Public display data is read from Auth with the caller's JWT, never from request JSON. */
@Component
public class CurrentProfileClient {

    private final RestClient client;

    public CurrentProfileClient(@Value("${auth.service-url:http://localhost:8081}") String url) {
        var factory = new JdkClientHttpRequestFactory(
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()
        );
        factory.setReadTimeout(Duration.ofSeconds(3));
        client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    public Profile current(String authorization) {
        if (authorization == null) return null;
        try {
            var response = client
                .get()
                .uri("/api/v1/users/me")
                .header("Authorization", authorization)
                .retrieve()
                .body(Envelope.class);
            return response != null && response.success() ? response.data() : null;
        } catch (RestClientException ignored) {
            // A display-name refresh must not make learning depend on Auth availability.
            return null;
        }
    }

    public record Profile(Long id, String fullName) {}

    private record Envelope(boolean success, Profile data) {}
}
