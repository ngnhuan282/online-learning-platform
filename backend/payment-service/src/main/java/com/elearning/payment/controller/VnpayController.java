package com.elearning.payment.controller;

import com.elearning.payment.entity.enums.PaymentStatus;
import com.elearning.payment.learning.PaidCourseActivationService;
import com.elearning.payment.vnpay.VnpayGateway;
import com.elearning.payment.vnpay.VnpayGateway.InvalidCallback;
import com.elearning.payment.vnpay.VnpayNotificationService;
import java.net.URI;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments/vnpay")
public class VnpayController {

    private static final Logger log = LoggerFactory.getLogger(VnpayController.class);
    private final VnpayGateway vnpay;
    private final VnpayNotificationService notifications;
    private final PaidCourseActivationService activation;

    public VnpayController(
        VnpayGateway vnpay,
        VnpayNotificationService notifications,
        PaidCourseActivationService activation
    ) {
        this.vnpay = vnpay;
        this.notifications = notifications;
        this.activation = activation;
    }

    @GetMapping("/return")
    ResponseEntity<Void> returnToWebsite(@RequestParam MultiValueMap<String, String> parameters) {
        String location = vnpay.invalidReturnUrl();
        try {
            var callback = vnpay.verify(parameters);
            notifications.validateReturn(callback);
            location = vnpay.resultUrl(callback.orderCode());
        } catch (InvalidCallback exception) {
            log.warn("VNPay return rejected code={}", exception.responseCode());
        }
        return ResponseEntity.status(HttpStatus.SEE_OTHER)
            .cacheControl(CacheControl.noStore())
            .header("Referrer-Policy", "no-referrer")
            .location(URI.create(location))
            .build();
    }

    @GetMapping("/ipn")
    ResponseEntity<Map<String, String>> receiveNotification(
        @RequestParam MultiValueMap<String, String> parameters
    ) {
        String code;
        try {
            var callback = vnpay.verify(parameters);
            code = notifications.recordIpn(callback);
            if (callback.status() == PaymentStatus.SUCCESS && ("00".equals(code) || "02".equals(code))) {
                try {
                    activation.activate(callback.orderCode(), null);
                } catch (RuntimeException exception) {
                    log.warn("VNPay recorded; course activation deferred");
                }
            }
        } catch (InvalidCallback exception) {
            code = exception.responseCode();
        } catch (RuntimeException exception) {
            log.warn("VNPay IPN could not be recorded");
            code = "99";
        }
        String message = switch (code) {
            case "00" -> "Confirm Success";
            case "02" -> "Order already confirmed";
            case "01" -> "Order not found";
            case "04" -> "Invalid amount";
            case "97" -> "Invalid signature";
            default -> "Unable to process notification";
        };
        // VNPay requires this provider-specific acknowledgement, not the application envelope.
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(Map.of("RspCode", code, "Message", message));
    }
}
