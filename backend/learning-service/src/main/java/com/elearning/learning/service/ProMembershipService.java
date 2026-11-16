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
    private final SecureRandom random = new SecureRandom();

    public ProMembershipService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Membership membership(long userId) {
        Instant now = clock.instant();
        var rows = jdbc.query(
            "SELECT expires_at, plan_code FROM pro_memberships WHERE user_id = ?",
            (row, i) -> {
                Instant expiry = row.getTimestamp(1) == null ? null : row.getTimestamp(1).toInstant();
                return new Membership(
                    userId,
                    expiry != null && expiry.isAfter(now),
                    expiry,
                    row.getString(2),
                    now
                );
            },
            userId
        );
        return rows.isEmpty() ? new Membership(userId, false, null, null, now) : rows.getFirst();
    }

    public boolean isActive(long userId) {
        return membership(userId).active();
    }

    public Membership grant(GrantRequest request) {
        if (request.durationMonths() != ProModels.months(request.planCode())) throw new AppException(
            ErrorCode.BAD_REQUEST
        );
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
        int months = ProModels.months(request.planCode());
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
        return new IssuedCode(raw, codeInfo(id));
    }

    @Transactional(readOnly = true)
    public List<CodeInfo> codes() {
        return jdbc.query("SELECT id FROM pro_activation_codes ORDER BY id DESC LIMIT 100", (row, i) ->
            codeInfo(row.getLong(1))
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
                    status
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
            "UPDATE pro_memberships SET expires_at = ?, plan_code = ? WHERE user_id = ?",
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
