package com.elearning.payment.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;

@Entity
@Table(name = "order_items")
@Getter
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private CourseOrder order;

    @Column(name = "course_id", nullable = false)
    private Long courseId;

    @Column(name = "course_title", nullable = false, length = 255)
    private String courseTitle;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "discount_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "final_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal finalPrice;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected OrderItem() {}

    public OrderItem(
        Long courseId,
        String courseTitle,
        BigDecimal unitPrice,
        BigDecimal discountAmount,
        BigDecimal finalPrice
    ) {
        this.courseId = courseId;
        this.courseTitle = courseTitle;
        this.unitPrice = unitPrice;
        this.discountAmount = discountAmount;
        this.finalPrice = finalPrice;
    }

    void assignTo(CourseOrder order) {
        this.order = order;
    }

    @PrePersist
    void created() {
        createdAt = Instant.now();
    }
}
