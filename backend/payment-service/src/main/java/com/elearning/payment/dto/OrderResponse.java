package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.OrderStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record OrderResponse(
    Long id,
    String orderCode,
    Long userId,
    OrderStatus status,
    BigDecimal totalAmount,
    String currency,
    List<OrderItemResponse> items,
    PaymentSummaryResponse payment,
    Instant expiresAt,
    Instant createdAt,
    Instant updatedAt
) {
    public OrderResponse {
        items = List.copyOf(items);
    }
}
