package com.elearning.payment.learning;

import com.elearning.payment.repository.PaymentRepository;
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
    name = "integrations.vnpay.activation-retry-enabled",
    havingValue = "true",
    matchIfMissing = true
)
public class PaidCourseActivationRetry {

    private static final Logger log = LoggerFactory.getLogger(PaidCourseActivationRetry.class);
    private final PaymentRepository payments;
    private final PaidCourseActivationService activation;

    public PaidCourseActivationRetry(PaymentRepository payments, PaidCourseActivationService activation) {
        this.payments = payments;
        this.activation = activation;
    }

    @Scheduled(initialDelay = 30000, fixedDelay = 30000)
    public void retryPendingActivation() {
        for (String orderCode : payments.findPendingVnpayActivations(PageRequest.of(0, 20))) {
            try {
                activation.activate(orderCode, null);
            } catch (RuntimeException exception) {
                log.warn("Paid course activation deferred; will retry");
            }
        }
    }
}
