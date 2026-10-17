package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.config.PaymentProviderPolicy;
import com.elearning.payment.entity.enums.PaymentProvider;
import org.junit.jupiter.api.Test;

class PaymentProviderPolicyTests {

    @Test
    void mockRequiresExplicitConfiguration() {
        var disabled = new PaymentProviderPolicy(false, "", "");
        assertThatThrownBy(() -> disabled.requireAvailable(PaymentProvider.MOCK))
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PAYMENT_MOCK_DISABLED);
        new PaymentProviderPolicy(true, "", "").requireAvailable(PaymentProvider.MOCK);
    }

    @Test
    void sandboxNeverFallsBackToMockOrAnUnsignedReturnUrl() {
        assertThatThrownBy(() -> new PaymentProviderPolicy(true, "", "").requireAvailable(PaymentProvider.VNPAY))
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PAYMENT_CONFIGURATION_ERROR);
        assertThatThrownBy(() -> new PaymentProviderPolicy(true, "test-code", "test-secret").requireAvailable(PaymentProvider.VNPAY))
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FEATURE_NOT_IMPLEMENTED);
    }
}
