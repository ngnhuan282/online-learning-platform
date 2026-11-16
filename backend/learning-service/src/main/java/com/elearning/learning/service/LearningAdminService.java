package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.common.response.PageResponse;
import com.elearning.learning.dto.LearningAdminModels.*;
import com.elearning.learning.security.LearningAdminAccess;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class LearningAdminService {

    private final JdbcTemplate jdbc;
    private final EngagementService engagement;
    private final EngagementRules rules;
    private final LearningAdminAudit audit;
    private final LearningAdminAccess access;
    private final Clock clock;

    public LearningAdminService(
        JdbcTemplate jdbc,
        EngagementService engagement,
        EngagementRules rules,
        LearningAdminAudit audit,
        LearningAdminAccess access,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.engagement = engagement;
        this.rules = rules;
        this.audit = audit;
        this.access = access;
        this.clock = clock;
    }

    public List<Map<String, Object>> items() {
        return rows("SELECT * FROM shop_items ORDER BY position,code");
    }

    public Map<String, Object> saveItem(String code, ItemRequest request, long actor) {
        Set<String> assets = switch (request.itemType()) {
            case "FRAME" -> Set.of("classic", "kitty-scholar", "koala-garden", "owl-wizard", "bunny-bloom");
            case "BACKGROUND" -> Set.of("sky", "campus-sunrise", "moonlit-library");
            case "FREEZE" -> Set.of("freeze");
            default -> throw new AppException(ErrorCode.BAD_REQUEST);
        };
        if (
            !assets.contains(request.assetKey()) ||
            (request.originalPrice() != null && request.originalPrice() < request.price())
        ) throw new AppException(ErrorCode.BAD_REQUEST);
        if (
            (request.itemType().equals("FRAME") && !request.code().startsWith("FRAME_")) ||
            (request.itemType().equals("BACKGROUND") && !request.code().startsWith("BACKGROUND_")) ||
            (request.itemType().equals("FREEZE") && (code == null || !request.code().equals("STREAK_FREEZE")))
        ) throw new AppException(ErrorCode.BAD_REQUEST);
        if (code == null) {
            if (
                !rows("SELECT code FROM shop_items WHERE code=?", request.code()).isEmpty()
            ) throw new AppException(ErrorCode.CONFLICT);
            jdbc.update(
                "INSERT INTO shop_items(code,name_key,item_type,rarity,price,original_price,asset_key,position,active) VALUES (?,?,?,?,?,?,?,?,?)",
                request.code(),
                request.nameKey().strip(),
                request.itemType(),
                request.rarity(),
                request.price(),
                request.originalPrice(),
                request.assetKey(),
                request.position(),
                request.active()
            );
        } else {
            var old = one("SELECT * FROM shop_items WHERE code=? FOR UPDATE", code);
            if (
                !code.equals(request.code()) || !old.get("itemType").equals(request.itemType())
            ) throw new AppException(ErrorCode.BAD_REQUEST);
            if (
                jdbc.update(
                    "UPDATE shop_items SET name_key=?,rarity=?,price=?,original_price=?,asset_key=?,position=?,active=?,version=version+1 WHERE code=? AND version=?",
                    request.nameKey().strip(),
                    request.rarity(),
                    request.price(),
                    request.originalPrice(),
                    request.assetKey(),
                    request.position(),
                    request.active(),
                    code,
                    request.version()
                ) != 1
            ) throw new AppException(ErrorCode.CONFLICT);
        }
        audit.record(
            actor,
            code == null ? "SHOP_CREATE" : "SHOP_UPDATE",
            request.code(),
            request.reason().strip() + "; price=" + request.price() + "; active=" + request.active()
        );
        return one("SELECT * FROM shop_items WHERE code=?", request.code());
    }

    public PageResponse<Map<String, Object>> purchases(Long userId, int page, int size) {
        String where = userId == null ? "" : " WHERE p.user_id=?";
        return page(
            "SELECT p.*,s.name_key FROM shop_purchases p JOIN shop_items s ON s.code=p.item_code",
            where,
            " ORDER BY p.created_at DESC,p.id DESC",
            page,
            size,
            userId == null ? List.of() : List.of(userId)
        );
    }

    public PageResponse<Map<String, Object>> learners(String keyword, int page, int size) {
        return page(
            "SELECT p.*,FLOOR(p.total_xp/" +
                rules.settings().xpPerLevel() +
                ")+1 AS level FROM learner_profiles p",
            " WHERE TRIM(CAST(p.user_id AS CHAR(30))) = ? OR LOCATE(LOWER(?),LOWER(p.display_name))>0",
            " ORDER BY p.user_id DESC",
            page,
            size,
            List.of(clean(keyword), clean(keyword))
        );
    }

    public Object learner(long userId) {
        requireProfile(userId);
        return engagement.summary(userId);
    }

    public List<Map<String, Object>> adjustments(long userId) {
        requireProfile(userId);
        return rows(
            "SELECT * FROM learner_admin_adjustments WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100",
            userId
        );
    }

    public List<Map<String, Object>> inventory(long userId) {
        requireProfile(userId);
        return rows(
            "SELECT i.*,s.name_key,s.item_type,s.asset_key,s.active FROM shop_inventory i JOIN shop_items s ON s.code=i.item_code WHERE i.user_id=? ORDER BY i.acquired_at DESC",
            userId
        );
    }

    public List<Map<String, Object>> saveInventory(
        long userId,
        String code,
        InventoryRequest request,
        long actor
    ) {
        requireProfile(userId);
        engagement.lockProfile(userId);
        var item = one("SELECT item_type FROM shop_items WHERE code=? FOR UPDATE", code);
        if ("FREEZE".equals(item.get("itemType"))) throw new AppException(ErrorCode.BAD_REQUEST);
        boolean owned = !rows(
            "SELECT item_code FROM shop_inventory WHERE user_id=? AND item_code=?",
            userId,
            code
        ).isEmpty();
        if (owned != request.owned()) {
            if (request.owned()) jdbc.update(
                "INSERT INTO shop_inventory(user_id,item_code,acquired_at) VALUES (?,?,?)",
                userId,
                code,
                Timestamp.from(clock.instant())
            );
            else {
                jdbc.update("DELETE FROM shop_inventory WHERE user_id=? AND item_code=?", userId, code);
                jdbc.update(
                    "UPDATE learner_profiles SET active_frame=CASE WHEN active_frame=? THEN NULL ELSE active_frame END,active_background=CASE WHEN active_background=? THEN NULL ELSE active_background END WHERE user_id=?",
                    code,
                    code,
                    userId
                );
            }
            audit.record(
                actor,
                request.owned() ? "INVENTORY_GRANT" : "INVENTORY_REVOKE",
                userId + ":" + code,
                request.reason().strip()
            );
        }
        return inventory(userId);
    }

    public Map<String, Object> adjust(long userId, AdjustmentRequest request, Authentication auth) {
        if (request.gemsDelta() != 0) require(auth, "GEM_ADJUST");
        if (request.xpDelta() != 0 || request.targetLevel() != null) require(auth, "XP_ADJUST");
        if (request.freezesDelta() != 0 || request.restoredStreak() != null) require(auth, "STREAK_ADJUST");
        if (
            (request.targetLevel() != null && request.xpDelta() != 0) ||
            (request.gemsDelta() == 0 &&
                request.xpDelta() == 0 &&
                request.targetLevel() == null &&
                request.freezesDelta() == 0 &&
                request.restoredStreak() == null)
        ) throw new AppException(ErrorCode.BAD_REQUEST);
        long actor = Long.parseLong(auth.getName());
        jdbc.update(
            "INSERT INTO learning_admin_actor_locks(actor_id) VALUES (?) ON DUPLICATE KEY UPDATE actor_id=actor_id",
            actor
        );
        jdbc.queryForObject(
            "SELECT actor_id FROM learning_admin_actor_locks WHERE actor_id=? FOR UPDATE",
            Long.class,
            actor
        );
        var prior = rows(
            "SELECT * FROM learner_admin_adjustments WHERE actor_id=? AND request_id=?",
            actor,
            request.requestId()
        );
        if (!prior.isEmpty()) {
            var p = prior.getFirst();
            if (
                number(p, "userId") != userId ||
                number(p, "gemsDelta") != request.gemsDelta() ||
                number(p, "freezesDelta") != request.freezesDelta() ||
                !Objects.equals(p.get("targetLevel"), request.targetLevel()) ||
                !Objects.equals(p.get("restoredStreak"), request.restoredStreak()) ||
                (request.targetLevel() == null && number(p, "xpDelta") != request.xpDelta()) ||
                !p.get("reason").equals(request.reason().strip())
            ) throw new AppException(ErrorCode.CONFLICT);
            return p;
        }
        requireProfile(userId);
        engagement.summary(userId); // locks profile and accounts for elapsed freeze days first
        var before = one("SELECT * FROM learner_profiles WHERE user_id=? FOR UPDATE", userId);
        long gems = number(before, "gems") + request.gemsDelta();
        long xp =
            request.targetLevel() == null
                ? number(before, "totalXp") + request.xpDelta()
                : (long) (request.targetLevel() - 1) * rules.settings().xpPerLevel();
        long freezes = number(before, "streakFreezes") + request.freezesDelta();
        if (
            gems < 0 ||
            gems > 1000000000 ||
            xp < 0 ||
            xp > 1000000000000L ||
            freezes < 0 ||
            freezes > ShopService.FREEZE_CAPACITY
        ) throw new AppException(ErrorCode.BAD_REQUEST);
        jdbc.update(
            "UPDATE learner_profiles SET gems=?,total_xp=?,streak_freezes=? WHERE user_id=?",
            gems,
            xp,
            freezes,
            userId
        );
        if (request.restoredStreak() != null) {
            LocalDate today = LocalDate.now(clock.withZone(EngagementService.ZONE));
            LocalDate through = today.equals(before.get("lastActivityDate")) ? today : today.minusDays(1);
            jdbc.update(
                "UPDATE learner_profiles SET current_streak=?,longest_streak=GREATEST(longest_streak,?),streak_accounted_through=? WHERE user_id=?",
                request.restoredStreak(),
                request.restoredStreak(),
                through,
                userId
            );
        }
        jdbc.update(
            """
            INSERT INTO learner_admin_adjustments(user_id,actor_id,request_id,gems_delta,xp_delta,target_level,freezes_delta,restored_streak,
            gems_before,gems_after,xp_before,xp_after,freezes_before,freezes_after,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            userId,
            actor,
            request.requestId(),
            request.gemsDelta(),
            xp - number(before, "totalXp"),
            request.targetLevel(),
            request.freezesDelta(),
            request.restoredStreak(),
            number(before, "gems"),
            gems,
            number(before, "totalXp"),
            xp,
            number(before, "streakFreezes"),
            freezes,
            request.reason().strip(),
            Timestamp.from(clock.instant())
        );
        audit.record(
            actor,
            "LEARNER_ADJUST",
            Long.toString(userId),
            "gem " +
                before.get("gems") +
                " -> " +
                gems +
                ", XP " +
                before.get("totalXp") +
                " -> " +
                xp +
                ", freeze " +
                freezes +
                "; " +
                request.reason().strip()
        );
        return one(
            "SELECT * FROM learner_admin_adjustments WHERE actor_id=? AND request_id=?",
            actor,
            request.requestId()
        );
    }

    public EngagementRules.Settings settings() {
        return rules.settings();
    }

    public Object saveSettings(SettingsRequest request, long actor) {
        var old = rules.settings();
        if (
            jdbc.update(
                "UPDATE engagement_settings SET lesson_xp=?,quiz_xp=?,daily_gems=?,xp_per_level=?,version=version+1 WHERE id=1 AND version=?",
                request.lessonXp(),
                request.quizXp(),
                request.dailyGems(),
                request.xpPerLevel(),
                request.version()
            ) != 1
        ) throw new AppException(ErrorCode.CONFLICT);
        audit.record(
            actor,
            "ENGAGEMENT_SETTINGS",
            "1",
            old + " -> " + rules.settings() + "; " + request.reason().strip()
        );
        return rules.settings();
    }

    public List<Map<String, Object>> rewards() {
        return rows("SELECT * FROM engagement_reward_rules ORDER BY code");
    }

    public Map<String, Object> saveReward(String code, RewardRequest request, long actor) {
        var old = one("SELECT * FROM engagement_reward_rules WHERE code=? FOR UPDATE", code);
        if (
            jdbc.update(
                "UPDATE engagement_reward_rules SET gems=?,active=?,version=version+1 WHERE code=? AND version=?",
                request.gems(),
                request.active(),
                code,
                request.version()
            ) != 1
        ) throw new AppException(ErrorCode.CONFLICT);
        audit.record(
            actor,
            "REWARD_UPDATE",
            code,
            "gems " +
                old.get("gems") +
                " -> " +
                request.gems() +
                "; active=" +
                request.active() +
                "; " +
                request.reason().strip()
        );
        return one("SELECT * FROM engagement_reward_rules WHERE code=?", code);
    }

    public PageResponse<Map<String, Object>> members(String keyword, int page, int size) {
        return page(
            "SELECT ids.user_id,COALESCE(p.display_name,CONCAT('Learner #',ids.user_id)) AS display_name,m.expires_at,m.plan_code,COALESCE(m.suspended,FALSE) AS suspended FROM (SELECT user_id FROM learner_profiles UNION SELECT user_id FROM pro_memberships) ids LEFT JOIN learner_profiles p ON p.user_id=ids.user_id LEFT JOIN pro_memberships m ON m.user_id=ids.user_id",
            " WHERE TRIM(CAST(ids.user_id AS CHAR(30)))=? OR LOCATE(LOWER(?),LOWER(COALESCE(p.display_name,CONCAT('Learner #',ids.user_id))))>0",
            " ORDER BY ids.user_id DESC",
            page,
            size,
            List.of(clean(keyword), clean(keyword))
        );
    }

    public List<Map<String, Object>> grants(long userId) {
        requireProTarget(userId);
        return rows(
            "SELECT * FROM pro_grants WHERE user_id=? ORDER BY granted_at DESC,id DESC LIMIT 100",
            userId
        );
    }

    public PageResponse<Map<String, Object>> posts(boolean hidden, int page, int size) {
        return page(
            "SELECT p.*,u.display_name FROM community_posts p JOIN learner_profiles u ON u.user_id=p.author_id",
            hidden ? " WHERE p.deleted_at IS NOT NULL" : " WHERE p.deleted_at IS NULL",
            " ORDER BY p.created_at DESC,p.id DESC",
            page,
            size,
            List.of()
        );
    }

    public void moderate(long postId, ModerationRequest request, long actor) {
        one("SELECT id FROM community_posts WHERE id=? FOR UPDATE", postId);
        jdbc.update(
            "UPDATE community_posts SET locked=?,deleted_at=?,updated_at=? WHERE id=?",
            request.locked(),
            request.hidden() ? Timestamp.from(clock.instant()) : null,
            Timestamp.from(clock.instant()),
            postId
        );
        audit.record(
            actor,
            "COMMUNITY_MODERATE",
            Long.toString(postId),
            "hidden=" + request.hidden() + "; locked=" + request.locked() + "; " + request.reason().strip()
        );
    }

    public List<Map<String, Object>> comments(long postId) {
        return rows(
            "SELECT c.*,p.display_name FROM community_comments c JOIN learner_profiles p ON p.user_id=c.author_id WHERE c.post_id=? ORDER BY c.created_at DESC LIMIT 100",
            postId
        );
    }

    public void moderateComment(long postId, long commentId, ModerationRequest request, long actor) {
        one("SELECT id FROM community_posts WHERE id=? FOR UPDATE", postId);
        one("SELECT id FROM community_comments WHERE id=? AND post_id=? FOR UPDATE", commentId, postId);
        jdbc.update(
            "UPDATE community_comments SET deleted_at=?,updated_at=? WHERE id=?",
            request.hidden() ? Timestamp.from(clock.instant()) : null,
            Timestamp.from(clock.instant()),
            commentId
        );
        if (request.hidden()) jdbc.update(
            "UPDATE community_posts SET accepted_comment_id=NULL WHERE id=? AND accepted_comment_id=?",
            postId,
            commentId
        );
        audit.record(
            actor,
            "COMMENT_MODERATE",
            Long.toString(commentId),
            "post=" + postId + "; hidden=" + request.hidden() + "; " + request.reason().strip()
        );
    }

    public List<Map<String, Object>> audit() {
        return rows("SELECT * FROM learning_admin_audit ORDER BY created_at DESC,id DESC LIMIT 100");
    }

    public void requireProfile(long userId) {
        one("SELECT user_id FROM learner_profiles WHERE user_id=?", userId);
    }

    public void requireProTarget(long userId) {
        if (!rows("SELECT user_id FROM learner_profiles WHERE user_id=?", userId).isEmpty()) return;
        one("SELECT user_id FROM pro_memberships WHERE user_id=?", userId);
        engagement.lockProfile(userId);
    }

    private void require(Authentication auth, String permission) {
        if (!access.allowed(auth, permission)) throw new AppException(ErrorCode.FORBIDDEN);
    }

    private String clean(String keyword) {
        if (keyword != null && keyword.length() > 120) throw new AppException(ErrorCode.BAD_REQUEST);
        return keyword == null ? "" : keyword.strip();
    }

    private long number(Map<String, Object> row, String key) {
        return ((Number) row.get(key)).longValue();
    }

    private PageResponse<Map<String, Object>> page(
        String select,
        String where,
        String order,
        int page,
        int size,
        List<?> values
    ) {
        if (page < 0 || page > 100000 || size < 1 || size > 100) throw new AppException(
            ErrorCode.BAD_REQUEST
        );
        long total = jdbc.queryForObject(
            "SELECT COUNT(*) FROM (" + select + where + ") counted",
            Long.class,
            values.toArray()
        );
        var args = new ArrayList<Object>(values);
        args.add(size);
        args.add((long) page * size);
        return new PageResponse<>(
            rows(select + where + order + " LIMIT ? OFFSET ?", args.toArray()),
            page,
            size,
            total,
            (int) ((total + size - 1) / size),
            (long) (page + 1) * size >= total
        );
    }

    private Map<String, Object> one(String sql, Object... args) {
        var result = rows(sql, args);
        if (result.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        return result.getFirst();
    }

    private List<Map<String, Object>> rows(String sql, Object... args) {
        return jdbc.query(
            sql,
            (row, i) -> {
                Map<String, Object> result = new LinkedHashMap<>();
                var columns = row.getMetaData();
                for (int n = 1; n <= columns.getColumnCount(); n++) {
                    String[] parts = columns.getColumnLabel(n).toLowerCase(Locale.ROOT).split("_");
                    StringBuilder key = new StringBuilder(parts[0]);
                    for (int j = 1; j < parts.length; j++) key.append(
                        Character.toUpperCase(parts[j].charAt(0))
                    ).append(parts[j].substring(1));
                    Object value = row.getObject(n);
                    if (value instanceof java.sql.Timestamp time) value = time.toInstant();
                    if (value instanceof java.sql.Date date) value = date.toLocalDate();
                    result.put(key.toString(), value);
                }
                return result;
            },
            args
        );
    }
}
