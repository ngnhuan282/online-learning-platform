package com.elearning.payment.dto;

import java.math.BigDecimal;

public record OrderItemResponse(
    Long courseId,
    String courseTitle,
    BigDecimal unitPrice,
    BigDecimal discountAmount,
    BigDecimal finalPrice
) {}
