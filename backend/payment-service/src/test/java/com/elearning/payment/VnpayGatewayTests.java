package com.elearning.payment;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.*;

import com.elearning.payment.entity.CourseOrder;
import com.elearning.payment.vnpay.VnpayGateway;
import com.elearning.payment.vnpay.VnpayGateway.InvalidCallback;
import com.elearning.payment.vnpay.VnpayProperties;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.util.LinkedMultiValueMap;

class VnpayGatewayTests {

    VnpayProperties configured() {
        var properties = new VnpayProperties();
        properties.setTmnCode("TEST0001");
        properties.setHashSecret("test-only-secret");
        properties.setIpnUrl(URI.create("https://gateway.test/api/v1/payments/vnpay/ipn"));
        return properties;
    }

    @Test
    void sign_whenMissingSecretHostOrCallbackIsInvalid_shouldRejectConfiguration() {
        // Arrange
        // Act
        assertThat(new VnpayProperties().isAvailable()).isFalse();
        var properties = configured();
        assertThat(properties.isAvailable()).isTrue();
        properties.setPaymentUrl(URI.create("https://vnpay.test/pay"));
        assertThat(properties.isAvailable()).isFalse();
        for (String ipn : new String[] {
            "http://gateway.test/api/v1/payments/vnpay/ipn",
            "https://gateway.test/wrong",
            "https://gateway.test/api/v1/payments/vnpay/ipn?secret=x",
        }) {
            properties = configured();
            properties.setIpnUrl(URI.create(ipn));
            assertThat(properties.isAvailable()).isFalse();
        }
        properties = configured();
        properties.setResultUrl(URI.create("https://website.test/payment/result?status=success"));
        // Assert
        assertThat(properties.isAvailable()).isFalse();
    }

    @Test
    void sign_whenDateAndAmountAreProvided_shouldUseGmtSevenAndExactMinorUnits() {
        // Arrange
        var order = mock(CourseOrder.class);
        // Act
        given(order.getOrderCode()).willReturn("LS-PAY-TEST-1");
        given(order.getTotalAmount()).willReturn(new BigDecimal("1234.56"));
        given(order.getCurrency()).willReturn("VND");
        given(order.getCreatedAt()).willReturn(Instant.parse("2026-10-13T23:55:00Z"));
        given(order.getExpiresAt()).willReturn(Instant.parse("2026-10-14T00:10:00Z"));
        String url = new VnpayGateway(configured()).createUrl(order, "127.0.0.1");
        // Assert
        assertThat(url).contains(
            "vnp_Amount=123456",
            "vnp_CreateDate=20261014065500",
            "vnp_ExpireDate=20261014071000",
            "vnp_OrderInfo=Thanh+toan+khoa+hoc+LS-PAY-TEST-1"
        );
        assertThat(VnpayGateway.minorAmount(new BigDecimal("1490000.00"))).isEqualTo("149000000");
        assertThatThrownBy(() -> VnpayGateway.minorAmount(new BigDecimal("1.001"))).isInstanceOf(
            ArithmeticException.class
        );
    }

    @Test
    void sign_whenMerchantIsInProduction_shouldRequireHttpsReturnAndResultUrls() {
        // Arrange
        var properties = configured();
        properties.setPaymentUrl(URI.create("https://pay.vnpay.vn/vpcpay.html"));
        // Act
        assertThat(properties.isAvailable()).isFalse();
        properties.setReturnUrl(URI.create("https://learn.test/api/v1/payments/vnpay/return"));
        properties.setResultUrl(URI.create("https://learn.test/payment/result"));
        assertThat(properties.isAvailable()).isTrue();
        properties.setPaymentUrl(URI.create("https://pay.vnpay.vn.untrusted.test/vpcpay.html"));
        // Assert
        assertThat(properties.isAvailable()).isFalse();
    }

    @Test
    void verify_whenCallbackIsUnsigned_shouldRejectBeforeInterpretingStatus() {
        // Arrange
        var values = new LinkedMultiValueMap<String, String>();
        // Act
        Map.of(
            "vnp_TxnRef",
            "LS-PAY-TEST-1",
            "vnp_ResponseCode",
            "00",
            "vnp_TransactionStatus",
            "00"
        ).forEach(values::add);
        assertThatThrownBy(() -> new VnpayGateway(configured()).verify(values))
            .isInstanceOf(InvalidCallback.class)
            .hasMessage("Payment callback rejected");
        values.add("vnp_SecureHash", "a".repeat(128));
        // Assert
        assertThatThrownBy(() -> new VnpayGateway(configured()).verify(values)).isInstanceOf(
            InvalidCallback.class
        );
    }
}
