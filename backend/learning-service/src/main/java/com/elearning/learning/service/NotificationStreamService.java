package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.RejectedExecutionException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class NotificationStreamService {

    private final ConcurrentMap<Long, Set<Connection>> connections = new ConcurrentHashMap<>();
    private final ScheduledThreadPoolExecutor scheduler = new ScheduledThreadPoolExecutor(1);
    private final ExecutorService writers = Executors.newVirtualThreadPerTaskExecutor();
    private final long maxDuration;

    public NotificationStreamService(
        @Value("${notifications.sse.heartbeat-ms:15000}") long heartbeat,
        @Value("${notifications.sse.max-duration-ms:240000}") long maxDuration
    ) {
        if (heartbeat <= 0 || maxDuration <= 0 || maxDuration > 240000) {
            throw new IllegalArgumentException("Invalid notification stream timing");
        }
        this.maxDuration = maxDuration;
        scheduler.setRemoveOnCancelPolicy(true);
        scheduler.scheduleWithFixedDelay(() ->
            connections.forEach((userId, items) -> items.forEach(connection ->
                dispatch(userId, connection, SseEmitter.event().comment("heartbeat"))
            )), heartbeat, heartbeat, TimeUnit.MILLISECONDS);
    }

    public SseEmitter open(Long userId, Instant tokenExpiry) {
        long remaining = tokenExpiry.toEpochMilli() - System.currentTimeMillis();
        if (remaining <= 0) throw new AppException(ErrorCode.UNAUTHORIZED);
        long lifetime = Math.min(maxDuration, remaining);
        var connection = new Connection(new SseEmitter(lifetime));
        connection.emitter.onCompletion(() -> remove(userId, connection));
        connection.emitter.onTimeout(() -> close(userId, connection));
        connection.emitter.onError(error -> remove(userId, connection));
        connections.compute(userId, (id, items) -> {
            if (items == null) items = ConcurrentHashMap.newKeySet();
            items.add(connection);
            return items;
        });
        synchronized (connection) {
            connection.expiry = scheduler.schedule(() -> close(userId, connection), lifetime, TimeUnit.MILLISECONDS);
        }
        send(userId, connection, SseEmitter.event().name("connected").data("{}"));
        return connection.emitter;
    }

    public void changed(Long userId) {
        var items = connections.get(userId);
        if (items == null) return;
        // SSE writes run outside the committing request; a failed client cannot fail a saved operation.
        items.forEach(connection ->
            dispatch(userId, connection, SseEmitter.event().name("notifications-changed").data("{}"))
        );
    }

    public int connectionCount(Long userId) {
        var items = connections.get(userId);
        return items == null ? 0 : items.size();
    }

    private void send(Long userId, Connection connection, SseEmitter.SseEventBuilder event) {
        synchronized (connection) {
            if (connection.closed) return;
            try {
                connection.emitter.send(event);
            } catch (IOException | IllegalStateException ex) {
                remove(userId, connection);
            }
        }
    }

    private void dispatch(Long userId, Connection connection, SseEmitter.SseEventBuilder event) {
        try {
            writers.execute(() -> send(userId, connection, event));
        } catch (RejectedExecutionException ex) {
            // Shutdown can race an after-commit callback; the saved operation still succeeds.
            remove(userId, connection);
        }
    }

    private void close(Long userId, Connection connection) {
        synchronized (connection) {
            if (connection.closed) return;
            remove(userId, connection);
            connection.emitter.complete();
        }
    }

    private void remove(Long userId, Connection connection) {
        synchronized (connection) {
            connection.closed = true;
            if (connection.expiry != null) connection.expiry.cancel(false);
            connections.computeIfPresent(userId, (id, items) -> {
                items.remove(connection);
                return items.isEmpty() ? null : items;
            });
        }
    }

    @PreDestroy
    void shutdown() {
        connections.forEach((userId, items) -> items.forEach(connection -> close(userId, connection)));
        scheduler.shutdownNow();
        writers.shutdownNow();
    }

    private static final class Connection {
        private final SseEmitter emitter;
        private ScheduledFuture<?> expiry;
        private boolean closed;

        private Connection(SseEmitter emitter) {
            this.emitter = emitter;
        }
    }
}
