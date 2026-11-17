package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.ProModels;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Payment owns the sellable catalog; issued codes and paid grants retain their duration snapshots. */
@Component
public class ProPlanCatalog {

    private final RestClient client;

    public ProPlanCatalog(
        @Value("${payment.service-url:${PAYMENT_SERVICE_URL:http://localhost:8084}}") String url
    ) {
        var factory = new JdkClientHttpRequestFactory(
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()
        );
        factory.setReadTimeout(Duration.ofSeconds(3));
        client = RestClient.builder()
            .baseUrl(url)
            .requestFactory(factory)
            .requestInterceptor((request, body, execution) -> {
                if (
                    RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
                ) {
                    String authorization = attributes.getRequest().getHeader("Authorization");
                    if (
                        authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)
                    ) request.getHeaders().set("Authorization", authorization);
                }
                return execution.execute(request, body);
            })
            .build();
    }

    public int months(String code) {
        // Legacy plans also remain available for manual support grants when no longer sold.
        if (List.of("PRO_MONTH", "PRO_QUARTER", "PRO_YEAR").contains(code)) return ProModels.months(code);
        try {
            var response = client.get().uri("/api/v1/payments/pro/plans").retrieve().body(Catalog.class);
            if (response != null && response.success() && response.data() != null) {
                return response
                    .data()
                    .stream()
                    .filter(
                        plan -> code.equals(plan.code()) && List.of(1, 3, 12).contains(plan.durationMonths())
                    )
                    .findFirst()
                    .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND))
                    .durationMonths();
            }
        } catch (RestClientException ex) {
            throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
        }
        throw new AppException(ErrorCode.NOT_FOUND);
    }

    public record Catalog(boolean success, List<Plan> data) {}

    public record Plan(String code, int durationMonths) {}
}
