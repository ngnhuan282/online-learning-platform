package com.elearning.payment.repository;

import com.elearning.payment.entity.CourseOrder;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseOrderRepository extends JpaRepository<CourseOrder, Long> {
    Optional<CourseOrder> findByOrderCode(String orderCode);
}
