package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.ProModels;
import com.elearning.learning.dto.ProModels.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ProMembershipService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final LearningAdminAudit audit;
    private final ProPlanCatalog catalog;
    private final SecureRandom random = new SecureRandom();

    public ProMembershipService(
        JdbcTemplate jdbc,
        Clock clock,
        LearningAdminAudit audit,
        ProPlanCatalog catalog
    ) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.audit = audit;
        this.catalog = catalog;
    }

    @Transactional(readOnly = true)
    public Membership membership(long userId) {
        Instant now = clock.instant();
        var rows = jdbc.query(
            "SELECT expires_at, plan_code, suspended, version FROM pro_memberships WHERE user_id = ?",
            (row, i) -> {
                Instant expiry = row.getTimestamp(1) == null ? null : row.getTimestamp(1).toInstant();
                return new Membership(
                    userId,
                    expiry != null && expiry.isAfter(now) && !row.getBoolean(3),
                    expiry,
                    row.getString(2),
                    now,
                    row.getBoolean(3),
                    row.getLong(4)
                );
            },
            userId
        );
        return rows.isEmpty() ? new Membership(userId, false, null, null, now, false, 0) : rows.getFirst();
    }

    public boolean isActive(long userId) {
        return membership(userId).active();
    }

    public Membership grant(GrantRequest request) {
        if (
            !List.of(1, 3, 12).contains(request.durationMonths()) ||
            (List.of("PRO_MONTH", "PRO_QUARTER", "PRO_YEAR").contains(request.planCode()) &&
                request.durationMonths() != ProModels.months(request.planCode()))
        ) throw new AppException(ErrorCode.BAD_REQUEST);
        lock(request.userId());
        return applyGrant(
            request.userId(),
            request.orderCode(),
            "PAYMENT",
            request.planCode(),
            request.durationMonths()
        );
    }

    public Membership revoke(RevokeRequest request) {
        lock(request.userId());
        var grants = jdbc.query(
            "SELECT user_id FROM pro_grants WHERE reference_code = ? FOR UPDATE",
            (row, i) -> row.getLong(1),
            request.orderCode()
        );
        if (grants.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        if (!grants.getFirst().equals(request.userId())) throw new AppException(ErrorCode.CONFLICT);
        jdbc.update(
            "UPDATE pro_grants SET revoked_at = ? WHERE reference_code = ? AND revoked_at IS NULL",
            Timestamp.from(clock.instant()),
            request.orderCode()
        );
        rebuild(request.userId());
        return membership(request.userId());
    }

    public Membership redeem(long userId, String suppliedCode) {
        lock(userId);
        if (membership(userId).suspended()) throw new AppException(ErrorCode.FORBIDDEN);
        String canonical = suppliedCode.strip().toUpperCase(Locale.ROOT).replace(" ", "");
        if (!canonical.matches("CCG-(?:[A-F0-9]{4}-){7}[A-F0-9]{4}")) throw new AppException(
            ErrorCode.INVALID_ACTIVATION_CODE
        );
        var codes = jdbc.query(
            "SELECT * FROM pro_activation_codes WHERE code_hash = ? FOR UPDATE",
            (row, i) ->
                new Code(
                    row.getLong("id"),
                    row.getString("plan_code"),
                    row.getInt("duration_months"),
                    row.getTimestamp("expires_at") == null
                        ? null
                        : row.getTimestamp("expires_at").toInstant(),
                    row.getObject("redeemed_by", Long.class),
                    row.getTimestamp("revoked_at") != null
                ),
            hash(canonical)
        );
        if (codes.isEmpty()) throw new AppException(ErrorCode.INVALID_ACTIVATION_CODE);
        Code code = codes.getFirst();
        if (Long.valueOf(userId).equals(code.redeemedBy())) return membership(userId);
        if (
            code.revoked() ||
            code.redeemedBy() != null ||
            (code.expiresAt() != null && !clock.instant().isBefore(code.expiresAt()))
        ) {
            throw new AppException(ErrorCode.INVALID_ACTIVATION_CODE);
        }
        jdbc.update(
            "UPDATE pro_activation_codes SET redeemed_by = ?, redeemed_at = ? WHERE id = ?",
            userId,
            Timestamp.from(clock.instant()),
            code.id()
        );
        return applyGrant(userId, "CODE-" + code.id(), "CODE", code.planCode(), code.months());
    }

    public IssuedCode createCode(long adminId, CreateCodeRequest request) {
        int months = catalog.months(request.planCode());
        Instant now = clock.instant();
        if (request.expiresAt() != null && !request.expiresAt().isAfter(now)) throw new AppException(
            ErrorCode.BAD_REQUEST
        );
        byte[] bytes = new byte[16];
        random.nextBytes(bytes);
        String hex = HexFormat.of().withUpperCase().formatHex(bytes);
        StringBuilder formatted = new StringBuilder("CCG");
        for (int offset = 0; offset < hex.length(); offset += 4) formatted
            .append('-')
            .append(hex, offset, offset + 4);
        String raw = formatted.toString();
        String digest = hash(raw);
        jdbc.update(
            """
            INSERT INTO pro_activation_codes (code_hash, code_suffix, plan_code, duration_months, created_by, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            digest,
            hex.substring(28),
            request.planCode(),
            months,
            adminId,
            Timestamp.from(now),
            request.expiresAt() == null ? null : Timestamp.from(request.expiresAt())
        );
        long id = jdbc.queryForObject(
            "SELECT id FROM pro_activation_codes WHERE code_hash = ?",
            Long.class,
            digest
        );
        audit.record(
            adminId,
            "PRO_CODE_CREATE",
            Long.toString(id),
            request.planCode() + "; expiry=" + request.expiresAt()
        );
        return new IssuedCode(raw, codeInfo(id));
    }

    @Transactional(readOnly = true)
    public List<CodeInfo> codes() {
        return jdbc.query("SELECT id FROM pro_activation_codes ORDER BY id DESC LIMIT 100", (row, i) ->
            codeInfo(row.getLong(1))
        );
    }

    @Transactional(readOnly = true)
    public com.elearning.learning.common.response.PageResponse<CodeInfo> codesPage(int page, int size) {
        if (page < 0 || page > 100000 || !List.of(5, 10, 20, 50).contains(size)) throw new AppException(
            ErrorCode.BAD_REQUEST
        );
        long total = jdbc.queryForObject("SELECT COUNT(*) FROM pro_activation_codes", Long.class);
        var content = jdbc
            .queryForList(
                "SELECT id FROM pro_activation_codes ORDER BY id DESC LIMIT ? OFFSET ?",
                Long.class,
                size,
                (long) page * size
            )
            .stream()
            .map(this::codeInfo)
            .toList();
        return new com.elearning.learning.common.response.PageResponse<>(
            content,
            page,
            size,
            total,
            (int) ((total + size - 1) / size),
            ((long) page + 1) * size >= total
        );
    }

    public CodeInfo revokeCode(long id) {
        var used = jdbc.query(
            "SELECT redeemed_by FROM pro_activation_codes WHERE id = ? FOR UPDATE",
            (row, i) -> row.getObject(1, Long.class),
            id
        );
        if (used.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        if (used.getFirst() != null) throw new AppException(ErrorCode.CONFLICT);
        jdbc.update(
            "UPDATE pro_activation_codes SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
            Timestamp.from(clock.instant()),
            id
        );
        return codeInfo(id);
    }

    public CodeInfo revokeCode(long id, long actor) {
        var result = revokeCode(id);
        audit.record(actor, "PRO_CODE_REVOKE", Long.toString(id), "Thu hồi mã Pro chưa sử dụng");
        return result;
    }

    public Membership grantAdmin(
        long userId,
        long actor,
        com.elearning.learning.dto.LearningAdminModels.GrantRequest request
    ) {
        lock(userId);
        String reference = "ADMIN-" + actor + "-" + request.requestId();
        var previous = jdbc.query(
            "SELECT user_id,plan_code,admin_reason,source_type FROM pro_grants WHERE reference_code=? FOR UPDATE",
            (row, i) -> new Object[] { row.getLong(1), row.getString(2), row.getString(3), row.getString(4) },
            reference
        );
        if (!previous.isEmpty()) {
            var prior = previous.getFirst();
            if (
                !Long.valueOf(userId).equals(prior[0]) ||
                !request.planCode().equals(prior[1]) ||
                !request.reason().strip().equals(prior[2]) ||
                !"ADMIN".equals(prior[3])
            ) throw new AppException(ErrorCode.CONFLICT);
            return membership(userId);
        }
        var result = applyGrant(
            userId,
            reference,
            "ADMIN",
            request.planCode(),
            catalog.months(request.planCode())
        );
        if (previous.isEmpty()) {
            jdbc.update(
                "UPDATE pro_grants SET actor_id=?,admin_reason=? WHERE reference_code=?",
                actor,
                request.reason().strip(),
                reference
            );
            audit.record(
                actor,
                "PRO_ADMIN_GRANT",
                Long.toString(userId),
                request.planCode() + "; " + request.reason().strip()
            );
        }
        return result;
    }

    public Membership revokeAdmin(long userId, long grantId, long actor, String reason) {
        lock(userId);
        var grants = jdbc.query(
            "SELECT reference_code,source_type,revoked_at FROM pro_grants WHERE id=? AND user_id=? FOR UPDATE",
            (r, i) -> new Object[] { r.getString(1), r.getString(2), r.getTimestamp(3) },
            grantId,
            userId
        );
        if (grants.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        var grant = grants.getFirst();
        if (!"ADMIN".equals(grant[1])) throw new AppException(ErrorCode.FORBIDDEN);
        var result = revoke(new RevokeRequest((String) grant[0], userId));
        if (grant[2] == null) audit.record(
            actor,
            "PRO_ADMIN_REVOKE",
            Long.toString(grantId),
            "user=" + userId + "; " + reason.strip()
        );
        return result;
    }

    public Membership updateAdminGrant(
        long userId,
        long grantId,
        long actor,
        com.elearning.learning.dto.LearningAdminModels.GrantUpdateRequest request
    ) {
        lock(userId);
        var sources = jdbc.query(
            "SELECT source_type,plan_code,duration_months FROM pro_grants WHERE id=? AND user_id=? FOR UPDATE",
            (row, i) -> new Object[] { row.getString(1), row.getString(2), row.getInt(3) },
            grantId,
            userId
        );
        if (sources.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        var old = sources.getFirst();
        if (!"ADMIN".equals(old[0])) throw new AppException(ErrorCode.FORBIDDEN);
        int months = request.planCode().equals(old[1])
            ? (Integer) old[2]
            : catalog.months(request.planCode());
        if (
            jdbc.update(
                "UPDATE pro_grants SET plan_code=?,duration_months=?,admin_reason=?,version=version+1 WHERE id=? AND user_id=? AND version=? AND revoked_at IS NULL",
                request.planCode(),
                months,
                request.reason().strip(),
                grantId,
                userId,
                request.version()
            ) != 1
        ) throw new AppException(ErrorCode.CONFLICT);
        rebuild(userId);
        audit.record(
            actor,
            "PRO_ADMIN_UPDATE",
            Long.toString(grantId),
            "user=" + userId + "; " + request.reason().strip()
        );
        return membership(userId);
    }

    public CodeInfo updateCode(
        long id,
        long actor,
        com.elearning.learning.dto.LearningAdminModels.CodeUpdateRequest request
    ) {
        if (
            jdbc
                .queryForList("SELECT id FROM pro_activation_codes WHERE id=? FOR UPDATE", Long.class, id)
                .isEmpty()
        ) throw new AppException(ErrorCode.NOT_FOUND);
        var old = codeInfo(id);
        if (!"AVAILABLE".equals(old.status()) && !"EXPIRED".equals(old.status())) throw new AppException(
            ErrorCode.CONFLICT
        );
        if (
            request.expiresAt() != null && !request.expiresAt().isAfter(clock.instant())
        ) throw new AppException(ErrorCode.BAD_REQUEST);
        if (
            jdbc.update(
                "UPDATE pro_activation_codes SET expires_at=?,version=version+1 WHERE id=? AND version=? AND redeemed_by IS NULL AND revoked_at IS NULL",
                request.expiresAt() == null ? null : Timestamp.from(request.expiresAt()),
                id,
                request.version()
            ) != 1
        ) throw new AppException(ErrorCode.CONFLICT);
        audit.record(actor, "PRO_CODE_UPDATE", Long.toString(id), request.reason().strip());
        return codeInfo(id);
    }

    public Membership suspend(
        long userId,
        long actor,
        com.elearning.learning.dto.LearningAdminModels.SuspensionRequest request
    ) {
        lock(userId);
        if (
            jdbc.update(
                "UPDATE pro_memberships SET suspended=?,version=version+1 WHERE user_id=? AND version=?",
                request.suspended(),
                userId,
                request.version()
            ) != 1
        ) throw new AppException(ErrorCode.CONFLICT);
        audit.record(
            actor,
            request.suspended() ? "PRO_SUSPEND" : "PRO_RESUME",
            Long.toString(userId),
            request.reason().strip()
        );
        return membership(userId);
    }

    private CodeInfo codeInfo(long id) {
        return jdbc.queryForObject(
            "SELECT * FROM pro_activation_codes WHERE id = ?",
            (row, i) -> {
                Instant expires =
                    row.getTimestamp("expires_at") == null
                        ? null
                        : row.getTimestamp("expires_at").toInstant();
                Instant redeemed =
                    row.getTimestamp("redeemed_at") == null
                        ? null
                        : row.getTimestamp("redeemed_at").toInstant();
                String status =
                    row.getTimestamp("revoked_at") != null
                        ? "REVOKED"
                        : redeemed != null
                          ? "USED"
                          : expires != null && !clock.instant().isBefore(expires)
                            ? "EXPIRED"
                            : "AVAILABLE";
                return new CodeInfo(
                    id,
                    "CCG-••••-" + row.getString("code_suffix"),
                    row.getString("plan_code"),
                    row.getInt("duration_months"),
                    row.getTimestamp("created_at").toInstant(),
                    expires,
                    row.getObject("redeemed_by", Long.class),
                    redeemed,
                    status,
                    row.getLong("version")
                );
            },
            id
        );
    }

    private void lock(long userId) {
        jdbc.update(
            "INSERT INTO pro_memberships (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id",
            userId
        );
        jdbc.queryForObject(
            "SELECT user_id FROM pro_memberships WHERE user_id = ? FOR UPDATE",
            Long.class,
            userId
        );
    }

    private Membership applyGrant(long userId, String reference, String source, String plan, int months) {
        var previous = jdbc.query(
            "SELECT user_id, plan_code, duration_months, source_type FROM pro_grants WHERE reference_code = ? FOR UPDATE",
            (row, i) -> new Grant(row.getLong(1), row.getString(2), row.getInt(3), row.getString(4)),
            reference
        );
        if (!previous.isEmpty()) {
            Grant prior = previous.getFirst();
            if (
                prior.userId() != userId ||
                !prior.plan().equals(plan) ||
                prior.months() != months ||
                !prior.source().equals(source)
            ) {
                throw new AppException(ErrorCode.CONFLICT);
            }
            return membership(userId);
        }
        jdbc.update(
            "INSERT INTO pro_grants (reference_code, user_id, source_type, plan_code, duration_months, granted_at) VALUES (?, ?, ?, ?, ?, ?)",
            reference,
            userId,
            source,
            plan,
            months,
            Timestamp.from(clock.instant())
        );
        rebuild(userId);
        return membership(userId);
    }

    private void rebuild(long userId) {
        var grants = jdbc.query(
            "SELECT granted_at, duration_months, plan_code FROM pro_grants WHERE user_id = ? AND revoked_at IS NULL ORDER BY granted_at, id",
            (row, i) -> new Period(row.getTimestamp(1).toInstant(), row.getInt(2), row.getString(3)),
            userId
        );
        Instant expiry = null;
        String plan = null;
        for (Period grant : grants) {
            Instant start = expiry != null && expiry.isAfter(grant.at()) ? expiry : grant.at();
            expiry = start.atZone(ZONE).plusMonths(grant.months()).toInstant();
            plan = grant.plan();
        }
        jdbc.update(
            "UPDATE pro_memberships SET expires_at = ?, plan_code = ?, version=version+1 WHERE user_id = ?",
            expiry == null ? null : Timestamp.from(expiry),
            plan,
            userId
        );
    }

    private String hash(String code) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private record Grant(long userId, String plan, int months, String source) {}

    private record Period(Instant at, int months, String plan) {}

    private record Code(
        long id,
        String planCode,
        int months,
        Instant expiresAt,
        Long redeemedBy,
        boolean revoked
    ) {}
}
