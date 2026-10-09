package com.elearning.payment.repository;

import com.elearning.payment.entity.CourseOrder;
import com.elearning.payment.entity.enums.PaymentStatus;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseOrderRepository extends JpaRepository<CourseOrder, Long> {
    Optional<CourseOrder> findByOrderCode(String orderCode);

    Optional<CourseOrder> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

    boolean existsByOrderCode(String orderCode);

    Page<CourseOrder> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Query(
        value = """
        select distinct o from CourseOrder o
        left join o.items item
        where o.userId = :userId
          and (:status is null or exists (
            select p.id from Payment p where p.order = o and p.status = :status
          ))
          and (:keyword is null
            or lower(o.orderCode) like :keyword
            or lower(item.courseTitle) like :keyword)
        """,
        countQuery = """
        select count(distinct o) from CourseOrder o
        left join o.items item
        where o.userId = :userId
          and (:status is null or exists (
            select p.id from Payment p where p.order = o and p.status = :status
          ))
          and (:keyword is null
            or lower(o.orderCode) like :keyword
            or lower(item.courseTitle) like :keyword)
        """
    )
    Page<CourseOrder> searchUserHistory(
        @Param("userId") Long userId,
        @Param("status") PaymentStatus status,
        @Param("keyword") String keyword,
        Pageable pageable
    );

    @Query(
        value = """
        select distinct o from CourseOrder o
        left join o.items item
        where (:status is null or exists (
            select p.id from Payment p where p.order = o and p.status = :status
          ))
          and (:keyword is null
            or lower(o.orderCode) like :keyword
            or lower(item.courseTitle) like :keyword)
        """,
        countQuery = """
        select count(distinct o) from CourseOrder o
        left join o.items item
        where (:status is null or exists (
            select p.id from Payment p where p.order = o and p.status = :status
          ))
          and (:keyword is null
            or lower(o.orderCode) like :keyword
            or lower(item.courseTitle) like :keyword)
        """
    )
    Page<CourseOrder> searchAdminOrders(
        @Param("status") PaymentStatus status,
        @Param("keyword") String keyword,
        Pageable pageable
    );

    @Query("select count(distinct o.userId) from CourseOrder o")
    long countDistinctUsers();

    @Query("select count(distinct item.courseId) from OrderItem item")
    long countDistinctCourses();
}
