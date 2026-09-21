package com.elearning.payment.entity;

import com.elearning.payment.entity.enums.PaymentEventType;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "payment_transactions")
@Getter
public class PaymentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "event_type", nullable = false, length = 40)
    private PaymentEventType eventType;

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

    @Column(name = "provider_transaction_code", length = 100)
    private String providerTransactionCode;

    @Column(name = "payload_checksum", length = 128)
    private String payloadChecksum;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PaymentTransaction() {}

    public PaymentTransaction(
        Payment payment,
        PaymentEventType eventType,
        PaymentProvider provider,
        PaymentStatus status,
        BigDecimal amount,
        String currency
    ) {
        this.payment = payment;
        this.eventType = eventType;
        this.provider = provider;
        this.status = status;
        this.amount = amount;
        this.currency = currency;
    }

    @PrePersist
    void created() {
        createdAt = Instant.now();
    }
}
