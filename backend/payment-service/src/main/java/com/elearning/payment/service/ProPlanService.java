package com.elearning.payment.service;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.dto.ProPaymentModels.Plan;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProPlanService {

    private final JdbcTemplate jdbc;

    public ProPlanService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Plan> plans() {
        BigDecimal monthly = jdbc.queryForObject(
            "SELECT price FROM pro_plans WHERE code = 'PRO_MONTH'",
            BigDecimal.class
        );
        return jdbc.query("SELECT * FROM pro_plans WHERE active = TRUE ORDER BY duration_months", (row, i) ->
            new Plan(
                row.getString("code"),
                row.getString("name"),
                row.getInt("duration_months"),
                row.getBigDecimal("price"),
                monthly
                    .multiply(BigDecimal.valueOf(row.getInt("duration_months")))
                    .max(row.getBigDecimal("price")),
                "VND"
            )
        );
    }

    public Plan requirePlan(String code) {
        return plans()
            .stream()
            .filter(plan -> plan.code().equals(code))
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }
}
