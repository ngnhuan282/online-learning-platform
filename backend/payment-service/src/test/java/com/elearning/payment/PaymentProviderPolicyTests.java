package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.config.PaymentProviderPolicy;
import com.elearning.payment.entity.enums.PaymentProvider;
import org.junit.jupiter.api.Test;

class PaymentProviderPolicyTests {

    @Test
    void isAvailable_whenMockProviderIsUnconfigured_shouldReturnUnavailable() {
        // Arrange
        var disabled = new PaymentProviderPolicy(false, "", "");
        // Act
        assertThatThrownBy(() -> disabled.requireAvailable(PaymentProvider.MOCK))
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PAYMENT_MOCK_DISABLED);
        // Assert
        new PaymentProviderPolicy(true, "", "").requireAvailable(PaymentProvider.MOCK);
    }

    @Test
    void isAvailable_whenSandboxCredentialsOrReturnUrlAreMissing_shouldAvoidMockFallback() {
        // Arrange
        // Act
        var thrown = catchThrowable(() -> new PaymentProviderPolicy(true, "", "").requireAvailable(PaymentProvider.VNPAY));

        // Assert
        assertThat(thrown)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.PAYMENT_CONFIGURATION_ERROR);
        assertThatThrownBy(() -> new PaymentProviderPolicy(true, "test-code", "test-secret").requireAvailable(PaymentProvider.VNPAY))
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FEATURE_NOT_IMPLEMENTED);
    }
}
