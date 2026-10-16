package com.elearning.payment.vnpay;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Component
@ConfigurationProperties(prefix = "integrations.vnpay")
@Validated
@Getter
@Setter
public class VnpayProperties {

    private String tmnCode = "";
    private String hashSecret = "";
    private URI paymentUrl = URI.create("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
    private URI returnUrl = URI.create("http://localhost:8080/api/v1/payments/vnpay/return");
    private URI ipnUrl;
    private URI resultUrl = URI.create("http://localhost:5173/payment/result");

    @Min(1)
    @Max(60)
    private int expireMinutes = 15;

    public boolean isAvailable() {
        return (
            tmnCode != null &&
            tmnCode.matches("[A-Za-z0-9]{8}") &&
            hashSecret != null &&
            !hashSecret.isBlank() &&
            paymentUrl != null &&
            paymentUrl.toString().equals("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html") &&
            validUrl(returnUrl, "/api/v1/payments/vnpay/return", false) &&
            validUrl(ipnUrl, "/api/v1/payments/vnpay/ipn", true) &&
            validUrl(resultUrl, "/payment/result", false)
        );
    }

    private boolean validUrl(URI url, String path, boolean httpsOnly) {
        return (
            url != null &&
            url.getHost() != null &&
            url.getUserInfo() == null &&
            url.getQuery() == null &&
            url.getFragment() == null &&
            path.equals(url.getPath()) &&
            ("https".equals(url.getScheme()) || (!httpsOnly && "http".equals(url.getScheme())))
        );
    }
}
