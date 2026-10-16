package com.elearning.payment.service;

import com.elearning.payment.dto.PaymentAnalyticsResponse;
import com.elearning.payment.entity.OrderItem;
import com.elearning.payment.entity.Payment;
import com.elearning.payment.entity.enums.PaymentStatus;
import com.elearning.payment.repository.CourseOrderRepository;
import com.elearning.payment.repository.PaymentRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentAnalyticsService {

    private static final DateTimeFormatter CHART_LABEL = DateTimeFormatter.ofPattern("dd/MM");

    private final CourseOrderRepository orders;
    private final PaymentRepository payments;

    public PaymentAnalyticsService(CourseOrderRepository orders, PaymentRepository payments) {
        this.orders = orders;
        this.payments = payments;
    }

    @Transactional(readOnly = true)
    public PaymentAnalyticsResponse getAnalytics() {
        long successfulPayments = payments.countByStatus(PaymentStatus.SUCCESS);
        Instant now = Instant.now();
        BigDecimal pendingAmount = payments.sumAwaitingPayment(now);
        return new PaymentAnalyticsResponse(
            orders.count(),
            payments.countAwaitingPayment(now),
            successfulPayments,
            payments.countByStatusIn(List.of(PaymentStatus.FAILED, PaymentStatus.CANCELLED)),
            sum(PaymentStatus.SUCCESS),
            pendingAmount == null ? BigDecimal.ZERO : pendingAmount,
            sum(PaymentStatus.REFUNDED),
            new PaymentAnalyticsResponse.CrossServiceStats(
                orders.countDistinctUsers(),
                orders.countDistinctCourses(),
                successfulPayments
            ),
            revenueSeries(),
            recentTransactions(),
            Instant.now()
        );
    }

    private BigDecimal sum(PaymentStatus status) {
        BigDecimal value = payments.sumAmountByStatus(status);
        return value == null ? BigDecimal.ZERO : value;
    }

    private List<PaymentAnalyticsResponse.RevenuePoint> revenueSeries() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return java.util.stream.IntStream.rangeClosed(0, 5)
            .mapToObj(today::minusDays)
            .sorted()
            .map(day -> {
                Instant start = day.atStartOfDay().toInstant(ZoneOffset.UTC);
                Instant end = day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
                List<Payment> dayPayments = payments.findByCreatedAtBetween(start, end);
                BigDecimal amount = dayPayments
                    .stream()
                    .filter(payment -> payment.getStatus() == PaymentStatus.SUCCESS)
                    .map(Payment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
                return new PaymentAnalyticsResponse.RevenuePoint(
                    CHART_LABEL.format(day),
                    amount,
                    dayPayments.size()
                );
            })
            .toList();
    }

    private List<PaymentAnalyticsResponse.RecentTransaction> recentTransactions() {
        return payments
            .findTop10ByOrderByCreatedAtDesc()
            .stream()
            .map(payment -> {
                OrderItem item = payment
                    .getOrder()
                    .getItems()
                    .stream()
                    .min(Comparator.comparing(OrderItem::getId))
                    .orElse(null);
                return new PaymentAnalyticsResponse.RecentTransaction(
                    payment.getOrder().getOrderCode(),
                    payment.getOrder().getUserId(),
                    item == null ? "Course" : item.getCourseTitle(),
                    payment.getAmount(),
                    payment.getCurrency(),
                    payment.getStatus(),
                    payment.getCreatedAt(),
                    payment.getOrder().getStatus(),
                    payment.getOrder().getExpiresAt(),
                    payment.getProvider()
                );
            })
            .toList();
    }
}
