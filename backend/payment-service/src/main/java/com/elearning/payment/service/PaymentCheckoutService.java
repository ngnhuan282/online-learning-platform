package com.elearning.payment.service;

import com.elearning.payment.dto.CheckoutRequest;
import com.elearning.payment.dto.CheckoutResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class PaymentCheckoutService {

    private final PaymentCoreService payments;

    public PaymentCheckoutService(PaymentCoreService payments) {
        this.payments = payments;
    }

    public CheckoutResponse createCheckout(CheckoutRequest request, Long userId, String clientIp) {
        try {
            return payments.createCheckout(request, userId, clientIp);
        } catch (DataIntegrityViolationException collision) {
            // The failed write transaction has ended. Read the winning checkout in a fresh transaction.
            // Other integrity errors must still reach the normal error handler.
            return payments.findExistingCheckout(request, userId).orElseThrow(() -> collision);
        }
    }
}
