package com.elearning.payment.repository;

import com.elearning.payment.entity.Payment;
import com.elearning.payment.entity.enums.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByOrder_IdOrderByCreatedAtDesc(Long orderId);

    Optional<Payment> findFirstByOrder_IdOrderByCreatedAtDesc(Long orderId);

    long countByStatus(PaymentStatus status);

    long countByStatusIn(Collection<PaymentStatus> statuses);

    @Query(
        """
        select count(p) from Payment p
        where p.status = com.elearning.payment.entity.enums.PaymentStatus.PENDING
          and (p.provider <> com.elearning.payment.entity.enums.PaymentProvider.VNPAY
            or (p.order.status <> com.elearning.payment.entity.enums.OrderStatus.EXPIRED
              and (p.order.expiresAt is null or p.order.expiresAt > :now)))
        """
    )
    long countAwaitingPayment(@Param("now") Instant now);

    @Query(
        """
        select sum(p.amount) from Payment p
        where p.status = com.elearning.payment.entity.enums.PaymentStatus.PENDING
          and (p.provider <> com.elearning.payment.entity.enums.PaymentProvider.VNPAY
            or (p.order.status <> com.elearning.payment.entity.enums.OrderStatus.EXPIRED
              and (p.order.expiresAt is null or p.order.expiresAt > :now)))
        """
    )
    BigDecimal sumAwaitingPayment(@Param("now") Instant now);

    @Query("select sum(payment.amount) from Payment payment where payment.status = :status")
    BigDecimal sumAmountByStatus(@Param("status") PaymentStatus status);

    List<Payment> findByCreatedAtBetween(Instant start, Instant end);

    List<Payment> findTop10ByOrderByCreatedAtDesc();

    @Query(
        "select p.order.orderCode from Payment p where p.provider = com.elearning.payment.entity.enums.PaymentProvider.VNPAY " +
            "and p.status = com.elearning.payment.entity.enums.PaymentStatus.SUCCESS and p.enrollmentActivatedAt is null order by p.createdAt"
    )
    List<String> findPendingVnpayActivations(Pageable pageable);
}
