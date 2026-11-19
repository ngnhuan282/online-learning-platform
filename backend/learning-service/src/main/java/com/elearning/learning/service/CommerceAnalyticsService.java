package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.CommerceAnalytics.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.ToLongFunction;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CommerceAnalyticsService {

    private static final int MAX_DAYS = 90;
    private static final int TREND_BARS = 7;
    private static final String ACQUIRED = """
        (p.item_granted = TRUE OR (p.item_granted IS NULL AND (p.gems_spent > 0 OR p.item_code = 'STREAK_FREEZE')))
        """;
    private final NamedParameterJdbcTemplate jdbc;
    private final Clock clock;

    public CommerceAnalyticsService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = new NamedParameterJdbcTemplate(jdbc);
        this.clock = clock;
    }

    public Report<ProPeriod, ProSnapshot, ProDetails> pro(LocalDate from, LocalDate to, boolean canViewCodes) {
        Instant now = clock.instant();
        Range range = range(from, to, now);
        Range previous = previous(range);
        var snapshot = jdbc.queryForObject(
            """
            SELECT COUNT(CASE WHEN NOT suspended AND expires_at > :now THEN 1 END),
                   COUNT(CASE WHEN NOT suspended AND expires_at > :now AND expires_at <= :soon THEN 1 END),
                   COUNT(CASE WHEN NOT suspended AND expires_at <= :now THEN 1 END),
                   COUNT(CASE WHEN suspended THEN 1 END)
            FROM pro_memberships
            """,
            Map.of("now", Timestamp.from(now), "soon", Timestamp.from(now.plus(30, ChronoUnit.DAYS))),
            (rs, index) -> new ProSnapshot(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4))
        );
        var grants = jdbc.query(
            """
            SELECT id, user_id, source_type, plan_code, duration_months, granted_at, revoked_at
            FROM pro_grants WHERE granted_at >= :start AND granted_at < :end
            ORDER BY granted_at DESC, id DESC LIMIT 20
            """,
            params(range),
            (rs, index) -> new Grant(
                rs.getLong("id"), rs.getLong("user_id"), rs.getString("source_type"), rs.getString("plan_code"),
                rs.getInt("duration_months"), instant(rs, "granted_at"), instant(rs, "revoked_at")
            )
        );
        return new Report<>(
            range, previous, now, proPeriod(range), proPeriod(previous), snapshot,
            trend(range, previous, bucket -> count(
                "SELECT COUNT(*) FROM pro_grants WHERE revoked_at IS NULL AND " + during("granted_at"), bucket
            )),
            new ProDetails(grants, canViewCodes ? codeReport(range, now) : null)
        );
    }

    public Report<GemPeriod, GemSnapshot, List<Adjustment>> gems(LocalDate from, LocalDate to) {
        Instant now = clock.instant();
        Range range = range(from, to, now);
        Range previous = previous(range);
        var snapshot = jdbc.queryForObject(
            "SELECT COALESCE(SUM(gems), 0), COUNT(CASE WHEN gems > 0 THEN 1 END) FROM learner_profiles",
            Map.of(),
            (rs, index) -> new GemSnapshot(rs.getLong(1), rs.getLong(2))
        );
        var adjustments = jdbc.query(
            """
            SELECT id, user_id, actor_id, gems_delta, reason, created_at
            FROM learner_admin_adjustments
            WHERE created_at >= :start AND created_at < :end AND gems_delta <> 0
            ORDER BY created_at DESC, id DESC LIMIT 20
            """,
            params(range),
            (rs, index) -> new Adjustment(
                rs.getLong("id"), rs.getLong("user_id"), rs.getLong("actor_id"), rs.getLong("gems_delta"),
                rs.getString("reason"), instant(rs, "created_at")
            )
        );
        return new Report<>(
            range, previous, now, gemPeriod(range), gemPeriod(previous), snapshot,
            trend(range, previous, bucket -> gemPeriod(bucket).issued()), adjustments
        );
    }

    public Report<ShopPeriod, ShopSnapshot, List<Item>> shop(LocalDate from, LocalDate to) {
        Instant now = clock.instant();
        Range range = range(from, to, now);
        Range previous = previous(range);
        var snapshot = jdbc.queryForObject(
            """
            SELECT COUNT(*),
                   COUNT(CASE WHEN i.item_code IN (u.active_frame, u.active_background) THEN 1 END),
                   (SELECT COALESCE(SUM(streak_freezes), 0) FROM learner_profiles)
            FROM shop_inventory i JOIN learner_profiles u ON u.user_id = i.user_id
            """,
            Map.of(),
            (rs, index) -> {
                long owners = rs.getLong(1);
                long equipped = rs.getLong(2);
                return new ShopSnapshot(owners, equipped, rs.getLong(3), equipRate(owners, equipped));
            }
        );
        var items = jdbc.query(
            """
            WITH sales AS (
                SELECT p.item_code, COUNT(*) AS purchases, COALESCE(SUM(p.gems_spent), 0) AS gem_spent
                FROM shop_purchases p WHERE p.created_at >= :start AND p.created_at < :end AND %s
                GROUP BY p.item_code ORDER BY purchases DESC, gem_spent DESC, p.item_code LIMIT 10
            )
            SELECT s.code, s.name_key, s.item_type, s.price, sales.purchases, sales.gem_spent,
                (SELECT COUNT(*) FROM shop_inventory i WHERE i.item_code = s.code) AS owners,
                (SELECT COUNT(*) FROM shop_inventory i JOIN learner_profiles u ON u.user_id = i.user_id
                 WHERE i.item_code = s.code AND i.item_code IN (u.active_frame, u.active_background)) AS equipped
            FROM sales JOIN shop_items s ON s.code = sales.item_code
            ORDER BY sales.purchases DESC, sales.gem_spent DESC, s.code
            """.formatted(ACQUIRED),
            params(range),
            (rs, index) -> {
                String type = rs.getString("item_type");
                boolean freeze = "FREEZE".equals(type);
                long owners = rs.getLong("owners");
                long equipped = rs.getLong("equipped");
                return new Item(
                    rs.getString("code"), rs.getString("name_key"), type, rs.getInt("price"),
                    rs.getLong("purchases"), rs.getLong("gem_spent"),
                    freeze ? null : owners, freeze ? null : equipped, freeze ? null : equipRate(owners, equipped)
                );
            }
        );
        return new Report<>(
            range, previous, now, shopPeriod(range), shopPeriod(previous), snapshot,
            trend(range, previous, bucket -> count(
                "SELECT COUNT(*) FROM shop_purchases p WHERE " + during("p.created_at") + " AND " + ACQUIRED, bucket
            )), items
        );
    }

    private ProPeriod proPeriod(Range range) {
        return jdbc.queryForObject(
            """
            SELECT COUNT(*) AS grants,
                   COUNT(CASE WHEN NOT EXISTS (
                       SELECT 1 FROM pro_grants earlier
                       WHERE earlier.user_id = g.user_id AND earlier.revoked_at IS NULL
                         AND (earlier.granted_at < g.granted_at OR
                              (earlier.granted_at = g.granted_at AND earlier.id < g.id))
                   ) THEN 1 END) AS new_members,
                   COUNT(CASE WHEN g.source_type = 'PAYMENT' THEN 1 END) AS paid,
                   COUNT(CASE WHEN g.source_type = 'CODE' THEN 1 END) AS code_grants,
                   COUNT(CASE WHEN g.source_type = 'ADMIN' THEN 1 END) AS admin,
                   (SELECT COUNT(*) FROM pro_grants WHERE revoked_at >= :start AND revoked_at < :end) AS revoked
            FROM pro_grants g WHERE g.revoked_at IS NULL AND g.granted_at >= :start AND g.granted_at < :end
            """,
            params(range),
            (rs, index) -> {
                long grants = rs.getLong("grants");
                long newMembers = rs.getLong("new_members");
                return new ProPeriod(
                    grants, newMembers, grants - newMembers, rs.getLong("paid"), rs.getLong("code_grants"),
                    rs.getLong("admin"), rs.getLong("revoked")
                );
            }
        );
    }

    private CodeReport codeReport(Range range, Instant now) {
        var parameters = new HashMap<>(params(range));
        parameters.put("now", Timestamp.from(now));
        var recent = jdbc.query(
            """
            SELECT id, code_suffix, plan_code, created_at, redeemed_at, expires_at,
                   CASE WHEN redeemed_at IS NOT NULL THEN 'REDEEMED'
                        WHEN revoked_at IS NOT NULL THEN 'REVOKED'
                        WHEN expires_at <= :now THEN 'EXPIRED'
                        ELSE 'AVAILABLE' END AS code_status
            FROM pro_activation_codes
            WHERE (created_at >= :start AND created_at < :end) OR (redeemed_at >= :start AND redeemed_at < :end)
            ORDER BY CASE WHEN redeemed_at >= :start AND redeemed_at < :end THEN redeemed_at ELSE created_at END DESC,
                     id DESC LIMIT 20
            """,
            parameters,
            (rs, index) -> new Code(
                rs.getLong("id"), "CCG-••••-" + rs.getString("code_suffix"), rs.getString("plan_code"),
                rs.getString("code_status"), instant(rs, "created_at"), instant(rs, "redeemed_at"),
                instant(rs, "expires_at")
            )
        );
        return new CodeReport(
            count("SELECT COUNT(*) FROM pro_activation_codes WHERE " + during("created_at"), range),
            count("SELECT COUNT(*) FROM pro_activation_codes WHERE " + during("redeemed_at"), range),
            recent
        );
    }

    private GemPeriod gemPeriod(Range range) {
        return jdbc.queryForObject(
            """
            SELECT
              (SELECT COALESCE(SUM(gems_awarded), 0) FROM learning_activity_days
               WHERE activity_date >= :from AND activity_date <= :to) AS daily,
              (SELECT COUNT(*) FROM learning_activity_days
               WHERE activity_date >= :from AND activity_date <= :to AND gems_awarded IS NULL) AS legacy_days,
              (SELECT COALESCE(SUM(gems), 0) FROM learner_rewards
               WHERE claimed_at >= :start AND claimed_at < :end) AS rewards,
              (SELECT COALESCE(SUM(gems), 0) FROM gem_topup_receipts
               WHERE created_at >= :start AND created_at < :end) AS topups,
              (SELECT COALESCE(SUM(gems_delta), 0) FROM learner_admin_adjustments
               WHERE created_at >= :start AND created_at < :end AND gems_delta > 0) AS credits,
              (SELECT COALESCE(SUM(-gems_delta), 0) FROM learner_admin_adjustments
               WHERE created_at >= :start AND created_at < :end AND gems_delta < 0) AS debits,
              (SELECT COALESCE(SUM(gems_spent), 0) FROM shop_purchases
               WHERE created_at >= :start AND created_at < :end AND item_code <> 'STREAK_FREEZE') AS items,
              (SELECT COALESCE(SUM(gems_spent), 0) FROM shop_purchases
               WHERE created_at >= :start AND created_at < :end AND item_code = 'STREAK_FREEZE') AS freezes
            """,
            params(range),
            (rs, index) -> {
                long daily = rs.getLong("daily");
                long rewards = rs.getLong("rewards");
                long topups = rs.getLong("topups");
                long credits = rs.getLong("credits");
                long debits = rs.getLong("debits");
                long items = rs.getLong("items");
                long freezes = rs.getLong("freezes");
                return new GemPeriod(
                    daily + rewards + topups + credits, debits + items + freezes, daily, rewards, topups,
                    credits, debits, items, freezes, rs.getLong("legacy_days")
                );
            }
        );
    }

    private ShopPeriod shopPeriod(Range range) {
        return jdbc.queryForObject(
            """
            SELECT COUNT(CASE WHEN %1$s THEN 1 END),
                   COALESCE(SUM(p.gems_spent), 0),
                   COUNT(DISTINCT CASE WHEN %1$s THEN p.user_id END),
                   COUNT(CASE WHEN %1$s AND p.item_code = 'STREAK_FREEZE' THEN 1 END),
                   (SELECT COUNT(*) FROM learning_frozen_days WHERE used_at >= :start AND used_at < :end),
                   COUNT(CASE WHEN p.item_granted IS NULL AND p.gems_spent = 0
                              AND p.item_code <> 'STREAK_FREEZE' THEN 1 END)
            FROM shop_purchases p WHERE p.created_at >= :start AND p.created_at < :end
            """.formatted(ACQUIRED),
            params(range),
            (rs, index) -> new ShopPeriod(
                rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5), rs.getLong(6)
            )
        );
    }

    private Range range(LocalDate from, LocalDate to, Instant now) {
        LocalDate today = now.atZone(EngagementService.ZONE).toLocalDate();
        if (from == null && to == null) return new Range(today.minusDays(29), today);
        if (from == null || to == null || from.getYear() < 1970 || to.isBefore(from) || to.isAfter(today)
            || ChronoUnit.DAYS.between(from, to) >= MAX_DAYS) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        return new Range(from, to);
    }

    private Range previous(Range range) {
        return new Range(range.from().minusDays(days(range)), range.from().minusDays(1));
    }

    private List<Point> trend(Range current, Range previous, ToLongFunction<Range> total) {
        long days = days(current);
        long step = (days + TREND_BARS - 1) / TREND_BARS;
        List<Point> points = new ArrayList<>();
        for (long offset = 0; offset < days; offset += step) {
            long end = Math.min(days, offset + step) - 1;
            Range bucket = new Range(current.from().plusDays(offset), current.from().plusDays(end));
            Range prior = new Range(previous.from().plusDays(offset), previous.from().plusDays(end));
            points.add(new Point(bucket, total.applyAsLong(bucket), total.applyAsLong(prior)));
        }
        return List.copyOf(points);
    }

    private long days(Range range) {
        return ChronoUnit.DAYS.between(range.from(), range.to()) + 1;
    }

    private long count(String sql, Range range) {
        return jdbc.queryForObject(sql, params(range), Long.class);
    }

    private String during(String column) {
        return "%1$s >= :start AND %1$s < :end".formatted(column);
    }

    private Double equipRate(long owners, long equipped) {
        return owners == 0 ? null : Math.round(1000.0 * equipped / owners) / 10.0;
    }

    private Map<String, Object> params(Range range) {
        return Map.of(
            "from", range.from(),
            "to", range.to(),
            "start", Timestamp.from(range.from().atStartOfDay(EngagementService.ZONE).toInstant()),
            "end", Timestamp.from(range.to().plusDays(1).atStartOfDay(EngagementService.ZONE).toInstant())
        );
    }

    private Instant instant(ResultSet result, String field) throws SQLException {
        Timestamp value = result.getTimestamp(field);
        return value == null ? null : value.toInstant();
    }
}
