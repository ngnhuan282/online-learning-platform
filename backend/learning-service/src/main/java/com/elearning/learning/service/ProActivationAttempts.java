package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProActivationAttempts {

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public ProActivationAttempts(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    // A separate transaction keeps the attempt count even when redemption is invalid.
    @Transactional
    public void consume(long userId) {
        Instant now = clock.instant();
        jdbc.update(
            "INSERT INTO pro_activation_attempts (user_id, window_start) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id = user_id",
            userId,
            Timestamp.from(now)
        );
        var state = jdbc.queryForObject(
            "SELECT window_start, attempts FROM pro_activation_attempts WHERE user_id = ? FOR UPDATE",
            (row, i) -> new Attempts(row.getTimestamp(1).toInstant(), row.getInt(2)),
            userId
        );
        int attempts = state.start().isAfter(now.minusSeconds(900)) ? state.count() : 0;
        if (attempts >= 6) throw new AppException(ErrorCode.ACTIVATION_RATE_LIMITED);
        jdbc.update(
            "UPDATE pro_activation_attempts SET window_start = ?, attempts = ? WHERE user_id = ?",
            Timestamp.from(attempts == 0 ? now : state.start()),
            attempts + 1,
            userId
        );
    }

    private record Attempts(Instant start, int count) {}
}
