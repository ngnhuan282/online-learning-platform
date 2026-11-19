package com.elearning.payment.service;

import com.elearning.payment.dto.CheckoutRequest;
import com.elearning.payment.dto.CheckoutResponse;
import com.elearning.payment.dto.GemTopUpModels;
import com.elearning.payment.dto.ProPaymentModels;
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

    public CheckoutResponse createProCheckout(
        ProPaymentModels.CheckoutRequest request,
        Long userId,
        String clientIp
    ) {
        try {
            return payments.createProCheckout(request, userId, clientIp);
        } catch (DataIntegrityViolationException collision) {
            return payments.findExistingProCheckout(request, userId).orElseThrow(() -> collision);
        }
    }

    public CheckoutResponse createGemCheckout(
        GemTopUpModels.CheckoutRequest request,
        Long userId,
        String clientIp
    ) {
        try {
            return payments.createGemCheckout(request, userId, clientIp);
        } catch (DataIntegrityViolationException collision) {
            return payments.findExistingGemCheckout(request, userId).orElseThrow(() -> collision);
        }
    }
}
