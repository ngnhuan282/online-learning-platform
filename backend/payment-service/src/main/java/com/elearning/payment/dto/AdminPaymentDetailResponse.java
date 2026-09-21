package com.elearning.payment.dto;

import java.util.List;

public record AdminPaymentDetailResponse(OrderResponse order, List<PaymentTransactionResponse> transactions) {
    public AdminPaymentDetailResponse {
        transactions = List.copyOf(transactions);
    }
}
