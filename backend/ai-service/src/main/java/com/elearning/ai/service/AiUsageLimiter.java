package com.elearning.ai.service;

import com.elearning.ai.common.exception.AppException;
import com.elearning.ai.common.exception.ErrorCode;
import com.elearning.ai.provider.AiProviderProperties;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class AiUsageLimiter {

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final AiProviderProperties properties;

    public AiUsageLimiter(
        JdbcTemplate jdbc,
        TransactionTemplate transaction,
        AiProviderProperties properties
    ) {
        this.jdbc = jdbc;
        this.transaction = transaction;
        this.properties = properties;
    }

    public void consume(Long userId) {
        LocalDate day = LocalDate.now(ZoneOffset.UTC);
        // The conditional UPDATE is atomic across conversations and service replicas.
        // Retry first-request insert collisions only after their transaction rolls back.
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                transaction.executeWithoutResult(status -> {
                    int changed = jdbc.update(
                        "UPDATE ai_daily_usage SET request_count = request_count + 1 WHERE user_id = ? AND usage_date = ? AND request_count < ?",
                        userId,
                        day,
                        properties.getDailyRequestLimit()
                    );
                    if (changed == 1) return;
                    Long existing = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM ai_daily_usage WHERE user_id = ? AND usage_date = ?",
                        Long.class,
                        userId,
                        day
                    );
                    if (existing != null && existing > 0) throw new AppException(ErrorCode.AI_QUOTA_EXCEEDED);
                    jdbc.update(
                        "INSERT INTO ai_daily_usage (user_id, usage_date, request_count) VALUES (?, ?, 1)",
                        userId,
                        day
                    );
                });
                return;
            } catch (DuplicateKeyException | TransientDataAccessException collision) {
                if (attempt == 2) throw new AppException(ErrorCode.AI_REQUEST_IN_PROGRESS);
            }
        }
    }
}
