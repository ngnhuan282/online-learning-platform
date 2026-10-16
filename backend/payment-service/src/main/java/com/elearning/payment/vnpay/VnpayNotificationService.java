package com.elearning.payment.vnpay;

import com.elearning.payment.entity.CourseOrder;
import com.elearning.payment.entity.Payment;
import com.elearning.payment.entity.PaymentTransaction;
import com.elearning.payment.entity.enums.OrderStatus;
import com.elearning.payment.entity.enums.PaymentEventType;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import com.elearning.payment.repository.CourseOrderRepository;
import com.elearning.payment.repository.PaymentRepository;
import com.elearning.payment.repository.PaymentTransactionRepository;
import com.elearning.payment.vnpay.VnpayGateway.Callback;
import com.elearning.payment.vnpay.VnpayGateway.InvalidCallback;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VnpayNotificationService {

    private final CourseOrderRepository orders;
    private final PaymentRepository payments;
    private final PaymentTransactionRepository transactions;

    public VnpayNotificationService(
        CourseOrderRepository orders,
        PaymentRepository payments,
        PaymentTransactionRepository transactions
    ) {
        this.orders = orders;
        this.payments = payments;
        this.transactions = transactions;
    }

    @Transactional(readOnly = true)
    public void validateReturn(Callback callback) {
        CourseOrder order = orders
            .findByOrderCode(callback.orderCode())
            .orElseThrow(() -> new InvalidCallback("01"));
        validatePayment(order, callback);
    }

    @Transactional
    public String recordIpn(Callback callback) {
        // Serialize callbacks before reading payment state, including concurrent duplicate delivery.
        CourseOrder order = orders
            .findLockedByOrderCode(callback.orderCode())
            .orElseThrow(() -> new InvalidCallback("01"));
        Payment payment = validatePayment(order, callback);
        if (payment.getStatus() != PaymentStatus.PENDING) return "02";
        Instant eventTime = callback.paidAt() == null ? Instant.now() : callback.paidAt();
        String failureCode = callback.status() == PaymentStatus.SUCCESS ? null : callback.responseCode();
        String failureMessage =
            callback.status() == PaymentStatus.CANCELLED
                ? "Hoc vien huy thanh toan tai VNPay."
                : callback.status() == PaymentStatus.FAILED
                  ? "VNPay thong bao thanh toan khong thanh cong."
                  : null;
        payment.transitionTo(
            callback.status(),
            callback.transactionCode(),
            failureCode,
            failureMessage,
            eventTime
        );
        order.changeStatus(
            callback.status() == PaymentStatus.SUCCESS ? OrderStatus.PAID : OrderStatus.CANCELLED
        );
        transactions.save(
            new PaymentTransaction(
                payment,
                PaymentEventType.PROVIDER_CALLBACK,
                PaymentProvider.VNPAY,
                payment.getStatus(),
                payment.getAmount(),
                payment.getCurrency(),
                callback.transactionCode(),
                null
            )
        );
        // Commit the provider outcome here. Learning activation runs in a separate transaction.
        return "00";
    }

    private Payment validatePayment(CourseOrder order, Callback callback) {
        Payment payment = payments
            .findFirstByOrder_IdOrderByCreatedAtDesc(order.getId())
            .orElseThrow(() -> new InvalidCallback("01"));
        if (payment.getProvider() != PaymentProvider.VNPAY) throw new InvalidCallback("01");
        if (
            !"VND".equals(payment.getCurrency()) ||
            payment.getAmount().compareTo(callback.amount()) != 0 ||
            order.getTotalAmount().compareTo(callback.amount()) != 0
        ) throw new InvalidCallback("04");
        if (
            callback.status() == PaymentStatus.SUCCESS &&
            (callback.paidAt().isBefore(order.getCreatedAt().truncatedTo(ChronoUnit.SECONDS)) ||
                callback.paidAt().isAfter(order.getExpiresAt()) ||
                callback.paidAt().isAfter(Instant.now().plusSeconds(300)))
        ) throw new InvalidCallback("99");
        return payment;
    }
}
