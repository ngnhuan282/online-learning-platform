package com.elearning.payment.entity;

import com.elearning.payment.entity.enums.OrderStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "orders")
@Getter
public class CourseOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_code", nullable = false, unique = true, length = 40)
    private String orderCode;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 30)
    private OrderStatus status;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    protected CourseOrder() {}

    public CourseOrder(
        String orderCode,
        Long userId,
        BigDecimal totalAmount,
        String currency,
        Instant expiresAt
    ) {
        this.orderCode = orderCode;
        this.userId = userId;
        this.totalAmount = totalAmount;
        this.currency = currency;
        this.expiresAt = expiresAt;
        this.status = OrderStatus.PENDING_PAYMENT;
    }

    public void addItem(OrderItem item) {
        item.assignTo(this);
        items.add(item);
    }

    public void changeStatus(OrderStatus status) {
        this.status = status;
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
