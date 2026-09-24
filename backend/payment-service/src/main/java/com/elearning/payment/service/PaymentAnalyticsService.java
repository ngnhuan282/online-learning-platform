package com.elearning.payment.service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentAnalyticsService {

    private final JdbcTemplate jdbc;

    public PaymentAnalyticsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalOrders", jdbc.queryForObject("SELECT COUNT(*) FROM orders", Long.class));
        result.put(
            "grossRevenue",
            jdbc.queryForObject(
                "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'PAID' AND currency = 'VND'",
                BigDecimal.class
            )
        );
        result.put(
            "successfulPayments",
            jdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE status = 'PAID'", Long.class)
        );
        List<Map<String, Object>> monthly = new ArrayList<>();
        YearMonth current = YearMonth.now(ZoneOffset.UTC);
        for (int i = 5; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            BigDecimal revenue = jdbc.queryForObject(
                "SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'PAID' AND currency = 'VND' AND created_at >= ? AND created_at < ?",
                BigDecimal.class,
                Timestamp.valueOf(month.atDay(1).atStartOfDay()),
                Timestamp.valueOf(month.plusMonths(1).atDay(1).atStartOfDay())
            );
            monthly.add(Map.of("month", month.toString(), "revenue", revenue));
        }
        result.put("monthly", monthly);
        var recent = jdbc.queryForList(
            "SELECT id, order_code AS orderCode, user_id AS userId, status, total_amount AS amount, currency, created_at AS createdAt FROM orders ORDER BY created_at DESC, id DESC LIMIT 5"
        );
        recent.forEach(order ->
            order.put(
                "courses",
                jdbc.queryForList(
                    "SELECT course_title FROM order_items WHERE order_id = ? ORDER BY id",
                    String.class,
                    order.get("id")
                )
            )
        );
        result.put("recent", recent);
        result.put("generatedAt", Instant.now());
        return result;
    }
}
