package com.elearning.learning.service;

import java.sql.Timestamp;
import java.time.Clock;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class LearningAdminAudit {

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public LearningAdminAudit(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public void record(long actor, String action, String target, String description) {
        jdbc.update(
            "INSERT INTO learning_admin_audit(actor_id,action,target,description,created_at) VALUES (?,?,?,?,?)",
            actor,
            action,
            target,
            description.substring(0, Math.min(500, description.length())),
            Timestamp.from(clock.instant())
        );
    }
}
