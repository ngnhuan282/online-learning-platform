package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.EngagementModels.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class EngagementService {

    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final List<String> REWARDS = List.of(
        "FIRST_LESSON",
        "STREAK_3",
        "STREAK_7",
        "STREAK_30",
        "LEVEL_5"
    );
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final EngagementRules rules;

    public EngagementService(JdbcTemplate jdbc, Clock clock, EngagementRules rules) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.rules = rules;
    }

    public void lockProfile(long userId) {
        jdbc.update(
            """
            INSERT INTO learner_profiles (user_id, display_name) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE user_id = user_id
            """,
            userId,
            "Learner #" + userId
        );
        jdbc.queryForObject(
            "SELECT user_id FROM learner_profiles WHERE user_id = ? FOR UPDATE",
            Long.class,
            userId
        );
    }

    public void syncProfile(long userId, CurrentProfileClient.Profile profile) {
        lockProfile(userId);
        if (
            profile != null &&
            Long.valueOf(userId).equals(profile.id()) &&
            profile.fullName() != null &&
            !profile.fullName().isBlank()
        ) {
            String name = profile.fullName().strip();
            jdbc.update(
                "UPDATE learner_profiles SET display_name = ? WHERE user_id = ?",
                name.substring(0, Math.min(100, name.length())),
                userId
            );
        }
    }

    public void lessonCompleted(long userId, long lessonId) {
        record(userId, "LESSON", lessonId, rules.settings().lessonXp());
    }

    public void quizSubmitted(long userId, long quizId) {
        record(userId, "QUIZ", quizId, rules.settings().quizXp());
    }

    private void record(long userId, String type, long sourceId, int xp) {
        lockProfile(userId);
        LocalDate today = LocalDate.now(clock.withZone(ZONE));
        reconcileFrozenDays(userId, today);
        Profile profile = profile(userId);
        boolean firstActivityToday = !today.equals(profile.lastDate());
        int streak = !firstActivityToday
            ? profile.streak()
            : profile.streak() > 0 && today.minusDays(1).equals(profile.through())
              ? profile.streak() + 1
              : 1;
        jdbc.update(
            """
            INSERT INTO learning_activity_days (user_id, activity_date) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE activity_count = activity_count + 1
            """,
            userId,
            today
        );
        jdbc.update(
            """
            UPDATE learner_profiles SET current_streak = ?, longest_streak = ?, last_activity_date = ?,
                streak_accounted_through = ?, gems = gems + ? WHERE user_id = ?
            """,
            streak,
            Math.max(streak, profile.longest()),
            today,
            today,
            firstActivityToday ? rules.settings().dailyGems() : 0,
            userId
        );
        long count = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM learning_xp_events WHERE user_id = ? AND source_type = ? AND source_id = ?
            """,
            Long.class,
            userId,
            type,
            sourceId
        );
        if (count == 0) {
            jdbc.update(
                """
                INSERT INTO learning_xp_events (user_id, source_type, source_id, xp, earned_at) VALUES (?, ?, ?, ?, ?)
                """,
                userId,
                type,
                sourceId,
                xp,
                Timestamp.from(clock.instant())
            );
            jdbc.update("UPDATE learner_profiles SET total_xp = total_xp + ? WHERE user_id = ?", xp, userId);
        }
    }

    public Summary summary(long userId) {
        lockProfile(userId);
        LocalDate today = LocalDate.now(clock.withZone(ZONE));
        reconcileFrozenDays(userId, today);
        Profile p = profile(userId);
        int streak = p.streak();
        var days = jdbc.query(
            """
            SELECT activity_date, activity_count FROM learning_activity_days
            WHERE user_id = ? AND activity_date >= ? AND activity_date <= ? ORDER BY activity_date
            """,
            (row, i) -> new ActivityDay(row.getDate(1).toLocalDate(), row.getInt(2)),
            userId,
            today.minusDays(89),
            today
        );
        Set<String> claimed = new HashSet<>(
            jdbc.queryForList(
                "SELECT reward_code FROM learner_rewards WHERE user_id = ?",
                String.class,
                userId
            )
        );
        boolean firstLesson =
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM learning_xp_events WHERE user_id = ? AND source_type = 'LESSON'",
                Long.class,
                userId
            ) > 0;
        var settings = rules.settings();
        var rewards = jdbc.query(
            "SELECT * FROM engagement_reward_rules WHERE active=TRUE AND deleted_at IS NULL ORDER BY threshold,code",
            (row, i) ->
                new Reward(
                    row.getString("code"),
                    row.getInt("gems"),
                    eligible(
                        row.getString("metric"),
                        row.getInt("threshold"),
                        p,
                        firstLesson,
                        settings.xpPerLevel()
                    ),
                    claimed.contains(row.getString("code")),
                    row.getString("label"),
                    row.getString("metric"),
                    row.getInt("threshold")
                )
        );
        return new Summary(
            userId,
            p.name(),
            p.xp(),
            p.xp() / settings.xpPerLevel() + 1,
            p.xp() % settings.xpPerLevel(),
            settings.xpPerLevel(),
            p.gems(),
            streak,
            p.longest(),
            today.equals(p.lastDate()),
            today,
            ZONE.getId(),
            p.frame(),
            p.background(),
            p.freezes(),
            jdbc.query(
                "SELECT frozen_date FROM learning_frozen_days WHERE user_id = ? AND frozen_date >= ? ORDER BY frozen_date",
                (row, i) -> row.getDate(1).toLocalDate(),
                userId,
                today.minusDays(89)
            ),
            days,
            rewards,
            settings.dailyGems(),
            settings.lessonXp(),
            settings.quizXp(),
            assetKey(p.frame()),
            assetKey(p.background())
        );
    }

    public Summary claim(long userId, String code) {
        lockProfile(userId);
        var rule = jdbc.queryForList(
            "SELECT gems,active,deleted_at FROM engagement_reward_rules WHERE code=? FOR UPDATE",
            code
        );
        if (
            rule.isEmpty() ||
            !Boolean.TRUE.equals(rule.getFirst().get("active")) ||
            rule.getFirst().get("deleted_at") != null
        ) throw new AppException(ErrorCode.NOT_FOUND);
        Reward reward = summary(userId)
            .rewards()
            .stream()
            .filter(r -> r.code().equals(code))
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (!reward.eligible()) throw new AppException(ErrorCode.CONFLICT);
        if (!reward.claimed()) {
            jdbc.update(
                "INSERT INTO learner_rewards (user_id, reward_code, gems, claimed_at) VALUES (?, ?, ?, ?)",
                userId,
                code,
                ((Number) rule.getFirst().get("gems")).intValue(),
                Timestamp.from(clock.instant())
            );
            jdbc.update(
                "UPDATE learner_profiles SET gems = gems + ? WHERE user_id = ?",
                ((Number) rule.getFirst().get("gems")).intValue(),
                userId
            );
        }
        return summary(userId);
    }

    public Summary equipFrame(long userId, String code) {
        lockProfile(userId);
        if (
            code != null &&
            !(
                jdbc.queryForObject(
                    "SELECT COUNT(*) FROM learner_rewards WHERE user_id = ? AND reward_code = ?",
                    Long.class,
                    userId,
                    code
                ) > 0
            ) &&
            jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM shop_inventory i JOIN shop_items s ON s.code = i.item_code
                WHERE i.user_id = ? AND i.item_code = ? AND s.item_type = 'FRAME'
                """,
                Long.class,
                userId,
                code
            ) == 0
        ) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        jdbc.update("UPDATE learner_profiles SET active_frame = ? WHERE user_id = ?", code, userId);
        return summary(userId);
    }

    @Transactional(readOnly = true)
    public Leaderboard leaderboard(long userId, String period, String month, int page, int size) {
        if (!Set.of("month", "all").contains(period) || page < 0 || page > 100000 || size < 1 || size > 50) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        YearMonth selected;
        try {
            selected = month == null ? YearMonth.now(clock.withZone(ZONE)) : YearMonth.parse(month);
            if (selected.getYear() < 1970 || selected.getYear() > 2100) throw new IllegalArgumentException();
        } catch (RuntimeException ex) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        String filter = "month".equals(period) ? " WHERE e.earned_at >= ? AND e.earned_at < ? " : " ";
        Object[] dates = "month".equals(period)
            ? new Object[] {
                  Timestamp.from(selected.atDay(1).atStartOfDay(ZONE).toInstant()),
                  Timestamp.from(selected.plusMonths(1).atDay(1).atStartOfDay(ZONE).toInstant()),
              }
            : new Object[0];
        int xpPerLevel = rules.settings().xpPerLevel();
        String ranked =
            """
            SELECT ROW_NUMBER() OVER (ORDER BY SUM(e.xp) DESC, MAX(e.earned_at), e.user_id) AS ranking,
                e.user_id, p.display_name, SUM(e.xp) AS xp, p.total_xp, p.active_frame, s.asset_key AS frame_asset_key,
                FLOOR(p.total_xp / %d) + 1 AS current_level
            FROM learning_xp_events e JOIN learner_profiles p ON p.user_id = e.user_id
            LEFT JOIN shop_items s ON s.code=p.active_frame
            """.formatted(xpPerLevel) +
            filter +
            " GROUP BY e.user_id, p.display_name, p.total_xp, p.active_frame,s.asset_key ";
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM (" + ranked + ") ranked", Long.class, dates);
        var parameters = new java.util.ArrayList<>(java.util.Arrays.asList(dates));
        parameters.add(size);
        parameters.add((long) page * size);
        List<Ranking> entries = jdbc.query(
            "SELECT * FROM (" + ranked + ") ranked ORDER BY ranking LIMIT ? OFFSET ?",
            this::ranking,
            parameters.toArray()
        );
        parameters = new java.util.ArrayList<>(java.util.Arrays.asList(dates));
        parameters.add(userId);
        List<Ranking> me = jdbc.query(
            "SELECT * FROM (" + ranked + ") ranked WHERE user_id = ?",
            this::ranking,
            parameters.toArray()
        );
        return new Leaderboard(
            period,
            selected.toString(),
            entries,
            page,
            size,
            total,
            (int) ((total + size - 1) / size),
            me.isEmpty() ? null : me.getFirst()
        );
    }

    private Ranking ranking(ResultSet row, int index) throws SQLException {
        return new Ranking(
            row.getLong("ranking"),
            row.getLong("user_id"),
            row.getString("display_name"),
            row.getLong("xp"),
            row.getLong("current_level"),
            row.getString("active_frame"),
            row.getString("frame_asset_key")
        );
    }

    private Profile profile(long userId) {
        return jdbc.queryForObject(
            "SELECT * FROM learner_profiles WHERE user_id = ?",
            (row, i) ->
                new Profile(
                    row.getString("display_name"),
                    row.getLong("total_xp"),
                    row.getInt("gems"),
                    row.getInt("current_streak"),
                    row.getInt("longest_streak"),
                    row.getDate("last_activity_date") == null
                        ? null
                        : row.getDate("last_activity_date").toLocalDate(),
                    row.getString("active_frame"),
                    row.getString("active_background"),
                    row.getInt("streak_freezes"),
                    row.getDate("streak_accounted_through") == null
                        ? null
                        : row.getDate("streak_accounted_through").toLocalDate()
                ),
            userId
        );
    }

    private boolean eligible(String metric, int threshold, Profile p, boolean firstLesson, int xpPerLevel) {
        return switch (metric) {
            case "FIRST_LESSON" -> firstLesson;
            case "STREAK" -> p.longest() >= threshold;
            case "LEVEL" -> p.xp() / xpPerLevel + 1 >= threshold;
            default -> false;
        };
    }

    private void reconcileFrozenDays(long userId, LocalDate today) {
        Profile p = profile(userId);
        LocalDate through = p.through() != null ? p.through() : p.lastDate();
        if (through == null || !through.isBefore(today.minusDays(1))) return;
        long missed = ChronoUnit.DAYS.between(through, today.minusDays(1));
        int used = p.streak() > 0 ? (int) Math.min(missed, p.freezes()) : 0;
        for (int i = 1; i <= used; i++) {
            jdbc.update(
                "INSERT INTO learning_frozen_days (user_id, frozen_date, used_at) VALUES (?, ?, ?)",
                userId,
                through.plusDays(i),
                Timestamp.from(clock.instant())
            );
        }
        jdbc.update(
            """
            UPDATE learner_profiles SET streak_freezes = streak_freezes - ?, current_streak = ?,
                streak_accounted_through = ? WHERE user_id = ?
            """,
            used,
            missed > used ? 0 : p.streak(),
            today.minusDays(1),
            userId
        );
    }

    private String assetKey(String code) {
        if (code == null) return null;
        var result = jdbc.queryForList("SELECT asset_key FROM shop_items WHERE code=?", String.class, code);
        return result.isEmpty() ? null : result.getFirst();
    }

    private record Profile(
        String name,
        long xp,
        int gems,
        int streak,
        int longest,
        LocalDate lastDate,
        String frame,
        String background,
        int freezes,
        LocalDate through
    ) {}
}
