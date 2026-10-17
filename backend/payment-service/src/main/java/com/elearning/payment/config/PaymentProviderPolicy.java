package com.elearning.payment.config;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.entity.enums.PaymentProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PaymentProviderPolicy {

    private final boolean mockEnabled;
    private final boolean sandboxConfigured;

    public PaymentProviderPolicy(
            @Value("${payment.mock-enabled:false}") boolean mockEnabled,
            @Value("${integrations.vnpay.tmn-code:}") String tmnCode,
            @Value("${integrations.vnpay.hash-secret:}") String hashSecret) {
        this.mockEnabled = mockEnabled;
        sandboxConfigured = !tmnCode.isBlank() && !hashSecret.isBlank();
    }

    public void requireAvailable(PaymentProvider provider) {
        if (provider == PaymentProvider.MOCK) {
            if (!mockEnabled) throw new AppException(ErrorCode.PAYMENT_MOCK_DISABLED);
            return;
        }
        if (!sandboxConfigured) throw new AppException(ErrorCode.PAYMENT_CONFIGURATION_ERROR);
        // The owner has not supplied a signed checkout/callback implementation in this repository.
        throw new AppException(ErrorCode.FEATURE_NOT_IMPLEMENTED);
    }

    public boolean isMockEnabled() {
        return mockEnabled;
    }
}
