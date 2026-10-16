package com.elearning.payment.vnpay;

import com.elearning.payment.repository.CourseOrderRepository;
import com.elearning.payment.service.PaymentCoreService;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Configuration
@EnableScheduling
@ConditionalOnProperty(
    name = "integrations.vnpay.expiry-enabled",
    havingValue = "true",
    matchIfMissing = true
)
public class VnpayOrderExpiry {

    private static final Logger log = LoggerFactory.getLogger(VnpayOrderExpiry.class);
    private final CourseOrderRepository orders;
    private final PaymentCoreService payments;

    public VnpayOrderExpiry(CourseOrderRepository orders, PaymentCoreService payments) {
        this.orders = orders;
        this.payments = payments;
    }

    @Scheduled(initialDelay = 30000, fixedDelay = 30000)
    public void expirePendingOrders() {
        for (String code : orders.findExpiredVnpayOrders(Instant.now(), PageRequest.of(0, 100))) {
            try {
                payments.expireVnpayOrder(code);
            } catch (RuntimeException exception) {
                log.warn("VNPay checkout expiry deferred; will retry");
            }
        }
    }
}
