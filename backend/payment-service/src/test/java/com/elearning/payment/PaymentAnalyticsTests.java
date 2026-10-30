package com.elearning.payment;

import static org.assertj.core.api.Assertions.assertThat;

import com.elearning.payment.entity.CourseOrder;
import com.elearning.payment.entity.Payment;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import com.elearning.payment.repository.CourseOrderRepository;
import com.elearning.payment.repository.PaymentRepository;
import com.elearning.payment.service.PaymentAnalyticsService;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
        "spring.datasource.url=jdbc:h2:mem:payment-analytics;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "security.jwt.secret=analytics-test-only-secret-at-least-32-bytes",
        "integrations.vnpay.activation-retry-enabled=false",
        "logging.level.root=WARN",
    }
)
@ActiveProfiles("test")
@Transactional
class PaymentAnalyticsTests {

    @Autowired
    CourseOrderRepository orders;

    @Autowired
    PaymentRepository payments;

    @Autowired
    PaymentAnalyticsService analytics;

    @Autowired
    JdbcTemplate jdbc;

    private final LocalDate yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1);

    private Instant midnight(LocalDate day) {
        return day.atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private void payment(int amount, Instant createdAt, Instant paidAt, PaymentStatus status) {
        var value = BigDecimal.valueOf(amount);
        var order = orders.saveAndFlush(
            new CourseOrder("AN-" + UUID.randomUUID(), 1L, null, value, "VND", null)
        );
        var payment = new Payment(order, PaymentProvider.MOCK, value, "VND");
        payment.transitionTo(status, "test-transaction", null, null, paidAt);
        payments.saveAndFlush(payment);
        jdbc.update(
            "UPDATE payments SET created_at = ? WHERE id = ?",
            Timestamp.from(createdAt),
            payment.getId()
        );
    }

    @Test
    void revenueFollowsPaidDateAndCreatedOrderCountKeepsItsOriginalMeaning() {
        payment(
            490000,
            midnight(yesterday.minusDays(1)).plusSeconds(60),
            midnight(yesterday).plusSeconds(60),
            PaymentStatus.SUCCESS
        );
        payment(990000, midnight(yesterday), null, PaymentStatus.FAILED);
        var series = analytics.getAnalytics().revenueSeries();
        var paidDay = series
            .stream()
            .filter(point -> point.label().equals(yesterday.format(DateTimeFormatter.ofPattern("dd/MM"))))
            .findFirst()
            .orElseThrow();
        var createdDay = series
            .stream()
            .filter(point ->
                point.label().equals(yesterday.minusDays(1).format(DateTimeFormatter.ofPattern("dd/MM")))
            )
            .findFirst()
            .orElseThrow();
        assertThat(paidDay.amount()).isEqualByComparingTo("490000");
        assertThat(paidDay.orders()).isEqualTo(1);
        assertThat(createdDay.amount()).isEqualByComparingTo("0");
        assertThat(createdDay.orders()).isEqualTo(1);
    }

    @Test
    void midnightBelongsToOnlyOneDayAndNonSuccessfulAmountsAreExcluded() {
        payment(790000, midnight(yesterday), midnight(yesterday), PaymentStatus.SUCCESS);
        payment(890000, midnight(yesterday), midnight(yesterday), PaymentStatus.REFUNDED);
        payment(990000, midnight(yesterday), null, PaymentStatus.PENDING);
        var report = analytics.getAnalytics();
        assertThat(
            report
                .revenueSeries()
                .stream()
                .map(point -> point.amount())
                .reduce(BigDecimal.ZERO, BigDecimal::add)
        ).isEqualByComparingTo("790000");
        assertThat(
            report
                .revenueSeries()
                .stream()
                .mapToLong(point -> point.orders())
                .sum()
        ).isEqualTo(3);
        assertThat(
            report
                .revenueSeries()
                .stream()
                .filter(point -> point.amount().signum() > 0)
                .count()
        ).isEqualTo(1);
    }
}
