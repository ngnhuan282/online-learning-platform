package com.elearning.gateway.exception;

import java.net.ConnectException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebExceptionHandler;
import reactor.core.publisher.Mono;
import tools.jackson.databind.json.JsonMapper;

@Component
public class GatewayExceptionHandler implements WebExceptionHandler, Ordered {

    private static final Logger log = LoggerFactory.getLogger(GatewayExceptionHandler.class);
    private final JsonMapper mapper;

    public GatewayExceptionHandler(JsonMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public int getOrder() {
        return -2;
    }

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable error) {
        if (exchange.getResponse().isCommitted()) return Mono.error(error);
        int status = error instanceof ResponseStatusException ex ? ex.getStatusCode().value() : 500;
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConnectException) {
                status = 503;
                break;
            }
            if (cause instanceof TimeoutException || cause.getClass().getSimpleName().contains("Timeout")) {
                status = 504;
                break;
            }
        }
        String code = switch (status) {
            case 400 -> "BAD_REQUEST";
            case 401 -> "UNAUTHORIZED";
            case 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            case 405 -> "METHOD_NOT_ALLOWED";
            case 415 -> "UNSUPPORTED_MEDIA_TYPE";
            case 429 -> "TOO_MANY_REQUESTS";
            case 502, 503 -> "SERVICE_UNAVAILABLE";
            case 504 -> "GATEWAY_TIMEOUT";
            default -> "GATEWAY_ERROR";
        };
        HttpStatus httpStatus = HttpStatus.resolve(status);
        var body = new LinkedHashMap<String, Object>();
        body.put("success", false);
        body.put("code", code);
        body.put("message", httpStatus == null ? "Gateway request failed" : httpStatus.getReasonPhrase());
        body.put("errors", null);
        body.put("timestamp", Instant.now());
        body.put("path", exchange.getRequest().getPath().value());
        if (status >= 500) log.error("Gateway failure code={}", code, error);
        else log.warn("Gateway request rejected code={}", code);
        exchange.getResponse().setStatusCode(HttpStatusCode.valueOf(status));
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        return exchange
            .getResponse()
            .writeWith(
                Mono.just(exchange.getResponse().bufferFactory().wrap(mapper.writeValueAsBytes(body)))
            );
    }
}
