package com.elearning.gateway.config;

import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.ReactiveHealthIndicator;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Component("coreDependencies")
public class CoreDependenciesHealth implements ReactiveHealthIndicator {

    private static final Logger log = LoggerFactory.getLogger(CoreDependenciesHealth.class);
    private final Map<String, String> services;
    private final WebClient client = WebClient.create();

    public CoreDependenciesHealth(
            @Value("${AUTH_SERVICE_URL:http://localhost:8081}") String auth,
            @Value("${COURSE_SERVICE_URL:http://localhost:8082}") String course,
            @Value("${LEARNING_SERVICE_URL:http://localhost:8083}") String learning,
            @Value("${PAYMENT_SERVICE_URL:http://localhost:8084}") String payment) {
        services = Map.of("auth", auth, "course", course, "learning", learning, "payment", payment);
    }

    @Override
    public Mono<Health> health() {
        return Flux.fromIterable(services.entrySet()).flatMap(service ->
                client.get().uri(service.getValue() + "/actuator/health/readiness")
                        .retrieve().bodyToMono(Probe.class).timeout(Duration.ofSeconds(2))
                        .map(probe -> "UP".equals(probe.status())).defaultIfEmpty(false)
                        .onErrorResume(error -> {
                            // Service names are safe; exception messages may contain internal URLs.
                            log.warn("dependency={} readiness=DOWN", service.getKey());
                            return Mono.just(false);
                        })
        ).all(Boolean::booleanValue).map(up -> up ? Health.up().build() : Health.down().build());
    }

    private record Probe(String status) {}
}
