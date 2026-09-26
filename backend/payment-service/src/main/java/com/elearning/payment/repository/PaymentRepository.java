package com.elearning.payment.repository;

import com.elearning.payment.entity.Payment;
import com.elearning.payment.entity.enums.PaymentStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByOrder_IdOrderByCreatedAtDesc(Long orderId);

    Optional<Payment> findFirstByOrder_IdOrderByCreatedAtDesc(Long orderId);

    long countByStatus(PaymentStatus status);

    long countByStatusIn(Collection<PaymentStatus> statuses);

    @Query("select sum(payment.amount) from Payment payment where payment.status = :status")
    BigDecimal sumAmountByStatus(@Param("status") PaymentStatus status);

    List<Payment> findByCreatedAtBetween(Instant start, Instant end);

    List<Payment> findTop10ByOrderByCreatedAtDesc();
}
