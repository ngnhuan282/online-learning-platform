package com.elearning.payment.repository;

import com.elearning.payment.entity.PaymentTransaction;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    List<PaymentTransaction> findByPayment_IdOrderByCreatedAtAsc(Long paymentId);
}
