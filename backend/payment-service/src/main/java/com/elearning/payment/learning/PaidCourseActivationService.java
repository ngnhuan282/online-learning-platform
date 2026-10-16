package com.elearning.payment.learning;

import com.elearning.payment.common.exception.AppException;
import com.elearning.payment.common.exception.ErrorCode;
import com.elearning.payment.entity.OrderItem;
import com.elearning.payment.entity.enums.PaymentProvider;
import com.elearning.payment.entity.enums.PaymentStatus;
import com.elearning.payment.repository.CourseOrderRepository;
import com.elearning.payment.repository.PaymentRepository;
import java.util.Comparator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaidCourseActivationService {

    private final CourseOrderRepository orders;
    private final PaymentRepository payments;
    private final LearningEnrollmentClient learning;

    public PaidCourseActivationService(
        CourseOrderRepository orders,
        PaymentRepository payments,
        LearningEnrollmentClient learning
    ) {
        this.orders = orders;
        this.payments = payments;
        this.learning = learning;
    }

    @Transactional
    public void activate(String orderCode, Long requestingUserId) {
        var order = orders
            .findLockedByOrderCode(orderCode)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (requestingUserId != null && !requestingUserId.equals(order.getUserId())) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
        var payment = payments
            .findFirstByOrder_IdOrderByCreatedAtDesc(order.getId())
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (payment.getProvider() != PaymentProvider.VNPAY || payment.getStatus() != PaymentStatus.SUCCESS) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        if (payment.getEnrollmentActivatedAt() != null) return;
        var item = order
            .getItems()
            .stream()
            .min(Comparator.comparing(OrderItem::getId))
            .orElseThrow(() -> new AppException(ErrorCode.CONFLICT));
        learning.enroll(orderCode, order.getUserId(), item.getCourseId());
        payment.markEnrollmentActivated();
    }
}
