package com.elearning.payment.entity;

import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "payments")
@Getter
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private CourseOrder order;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private PaymentProvider provider;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "checkout_url", length = 1024)
    private String checkoutUrl;

    @Column(name = "provider_transaction_code", length = 100)
    private String providerTransactionCode;

    @Column(name = "failure_code", length = 100)
    private String failureCode;

    @Column(name = "failure_message", length = 500)
    private String failureMessage;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Payment() {}

    public Payment(CourseOrder order, PaymentProvider provider, BigDecimal amount, String currency) {
        this.order = order;
        this.provider = provider;
        this.amount = amount;
        this.currency = currency;
        this.status = PaymentStatus.PENDING;
    }

    public void assignCheckoutUrl(String checkoutUrl) {
        this.checkoutUrl = checkoutUrl;
    }

    public void transitionTo(
        PaymentStatus status,
        String providerTransactionCode,
        String failureCode,
        String failureMessage,
        Instant eventTime
    ) {
        this.status = status;
        if (providerTransactionCode != null && !providerTransactionCode.isBlank()) {
            this.providerTransactionCode = providerTransactionCode.strip();
        }
        if (status == PaymentStatus.SUCCESS) {
            this.paidAt = eventTime == null ? Instant.now() : eventTime;
            this.failureCode = null;
            this.failureMessage = null;
        } else if (status == PaymentStatus.FAILED || status == PaymentStatus.CANCELLED) {
            this.paidAt = null;
            this.failureCode = failureCode;
            this.failureMessage = failureMessage;
        } else if (status == PaymentStatus.REFUNDED) {
            this.failureCode = null;
            this.failureMessage = null;
        }
    }

    @PrePersist
    void created() {
        createdAt = updatedAt = Instant.now();
    }

    @PreUpdate
    void updated() {
        updatedAt = Instant.now();
    }
}
