package com.elearning.learning.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class EngagementRules {

    private final JdbcTemplate jdbc;

    public EngagementRules(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Settings settings() {
        return jdbc.queryForObject("SELECT * FROM engagement_settings WHERE id=1", (r, i) ->
            new Settings(
                r.getInt("lesson_xp"),
                r.getInt("quiz_xp"),
                r.getInt("daily_gems"),
                r.getInt("xp_per_level"),
                r.getLong("version")
            )
        );
    }

    public record Settings(int lessonXp, int quizXp, int dailyGems, int xpPerLevel, long version) {}
}
