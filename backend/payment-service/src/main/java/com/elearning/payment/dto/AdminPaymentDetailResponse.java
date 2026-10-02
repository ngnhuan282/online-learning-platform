package com.elearning.payment.dto;

import com.elearning.payment.entity.enums.PaymentStatus;
import java.util.List;

public record AdminPaymentDetailResponse(
    OrderResponse order,
    List<PaymentTransactionResponse> transactions,
    List<PaymentStatus> availableStatuses
) {
    public AdminPaymentDetailResponse {
        transactions = List.copyOf(transactions);
        availableStatuses = List.copyOf(availableStatuses);
    }
}
