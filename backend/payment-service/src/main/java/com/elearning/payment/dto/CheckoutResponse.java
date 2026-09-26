package com.elearning.payment.dto;

public record CheckoutResponse(
    String orderCode,
    OrderResponse order,
    PaymentSummaryResponse payment,
    String checkoutUrl
) {}
