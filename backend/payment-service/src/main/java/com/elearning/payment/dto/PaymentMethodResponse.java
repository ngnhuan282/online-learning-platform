package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.PaymentProvider;

public record PaymentMethodResponse(
    PaymentProvider provider,
    String label,
    boolean available,
    String description
) {}
