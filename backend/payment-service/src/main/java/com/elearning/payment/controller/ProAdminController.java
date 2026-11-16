package com.elearning.payment.controller;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.common.response.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.security.Principal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments/admin")
public class ProAdminController {

    private final JdbcTemplate jdbc;

    public ProAdminController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Plan(
        String code,
        String name,
        int durationMonths,
        BigDecimal price,
        boolean active,
        long version
    ) {}

    public record PlanRequest(
        @NotBlank @Size(max = 120) String name,
        @NotNull @DecimalMin("1") @DecimalMax("100000000") BigDecimal price,
        boolean active,
        @Min(0) long version,
        @NotBlank @Size(max = 400) String reason
    ) {}

    public record Audit(
        long id,
        long actorId,
        String action,
        String target,
        String description,
        java.time.Instant createdAt
    ) {}

    @GetMapping("/pro/plans")
    @PreAuthorize("@paymentAdmin.allowed(authentication,'PRO_PLAN_VIEW')")
    public ApiResponse<?> plans() {
        return ApiResponse.success(
            jdbc.query("SELECT * FROM pro_plans ORDER BY duration_months", (r, i) ->
                new Plan(
                    r.getString("code"),
                    r.getString("name"),
                    r.getInt("duration_months"),
                    r.getBigDecimal("price"),
                    r.getBoolean("active"),
                    r.getLong("version")
                )
            )
        );
    }

    @PutMapping("/pro/plans/{code}")
    @PreAuthorize("@paymentAdmin.allowed(authentication,'PRO_PLAN_UPDATE')")
    @Transactional
    public ApiResponse<?> update(
        @PathVariable String code,
        @Valid @RequestBody PlanRequest request,
        Principal principal
    ) {
        var old = jdbc.queryForList(
            "SELECT price FROM pro_plans WHERE code=? FOR UPDATE",
            BigDecimal.class,
            code
        );
        if (old.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        if (request.price().stripTrailingZeros().scale() > 0) throw new AppException(ErrorCode.BAD_REQUEST);
        if (
            jdbc.update(
                "UPDATE pro_plans SET name=?,price=?,active=?,version=version+1 WHERE code=? AND version=?",
                request.name().strip(),
                request.price(),
                request.active(),
                code,
                request.version()
            ) != 1
        ) throw new AppException(ErrorCode.CONFLICT);
        String details =
            "price " +
            old.getFirst() +
            " -> " +
            request.price() +
            "; active=" +
            request.active() +
            "; " +
            request.reason().strip();
        jdbc.update(
            "INSERT INTO payment_admin_audit(actor_id,action,target,description,created_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP(6))",
            Long.parseLong(principal.getName()),
            "PRO_PLAN_UPDATE",
            code,
            details.substring(0, Math.min(500, details.length()))
        );
        return plans();
    }

    @GetMapping("/audit")
    @PreAuthorize("@paymentAdmin.allowed(authentication,'AUDIT_VIEW')")
    public ApiResponse<?> audit() {
        return ApiResponse.success(
            jdbc.query(
                "SELECT * FROM payment_admin_audit ORDER BY created_at DESC,id DESC LIMIT 100",
                (r, i) ->
                    new Audit(
                        r.getLong("id"),
                        r.getLong("actor_id"),
                        r.getString("action"),
                        r.getString("target"),
                        r.getString("description"),
                        r.getTimestamp("created_at").toInstant()
                    )
            )
        );
    }
}
