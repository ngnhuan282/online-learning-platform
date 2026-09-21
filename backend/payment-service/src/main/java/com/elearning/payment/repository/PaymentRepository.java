package com.elearning.payment.repository;

import com.elearning.payment.entity.Payment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByOrder_IdOrderByCreatedAtDesc(Long orderId);
}
