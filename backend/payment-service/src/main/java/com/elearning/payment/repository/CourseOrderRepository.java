package com.elearning.payment.repository;

import com.elearning.payment.entity.CourseOrder;
import com.elearning.payment.entity.enums.PaymentStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseOrderRepository extends JpaRepository<CourseOrder, Long> {
    Optional<CourseOrder> findByOrderCode(String orderCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CourseOrder o where o.orderCode = :orderCode")
    Optional<CourseOrder> findLockedByOrderCode(@Param("orderCode") String orderCode);

    Optional<CourseOrder> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

    boolean existsByOrderCode(String orderCode);

    @Query(
        """
        select o.orderCode from CourseOrder o
        where o.status = com.elearning.payment.entity.enums.OrderStatus.PENDING_PAYMENT
          and o.expiresAt <= :now
          and exists (select p.id from Payment p where p.order = o
            and p.provider = com.elearning.payment.entity.enums.PaymentProvider.VNPAY
            and p.status = com.elearning.payment.entity.enums.PaymentStatus.PENDING)
        order by o.expiresAt, o.id
        """
    )
    List<String> findExpiredVnpayOrders(@Param("now") Instant now, Pageable pageable);

    Page<CourseOrder> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Query(
        value = """
        select distinct o from CourseOrder o
        left join o.items item
        where o.userId = :userId
          and (:status is null or exists (
            select p.id from Payment p where p.order = o and p.status = :status
              and (p.status <> com.elearning.payment.entity.enums.PaymentStatus.PENDING
                or p.provider <> com.elearning.payment.entity.enums.PaymentProvider.VNPAY
                or (o.status <> com.elearning.payment.entity.enums.OrderStatus.EXPIRED
                  and (o.expiresAt is null or o.expiresAt > :now)))
          ))
          and (:expired = false or exists (select p.id from Payment p where p.order = o
            and p.provider = com.elearning.payment.entity.enums.PaymentProvider.VNPAY
            and p.status = com.elearning.payment.entity.enums.PaymentStatus.PENDING
            and (o.status = com.elearning.payment.entity.enums.OrderStatus.EXPIRED or o.expiresAt <= :now)))
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
              and (p.status <> com.elearning.payment.entity.enums.PaymentStatus.PENDING
                or p.provider <> com.elearning.payment.entity.enums.PaymentProvider.VNPAY
                or (o.status <> com.elearning.payment.entity.enums.OrderStatus.EXPIRED
                  and (o.expiresAt is null or o.expiresAt > :now)))
          ))
          and (:expired = false or exists (select p.id from Payment p where p.order = o
            and p.provider = com.elearning.payment.entity.enums.PaymentProvider.VNPAY
            and p.status = com.elearning.payment.entity.enums.PaymentStatus.PENDING
            and (o.status = com.elearning.payment.entity.enums.OrderStatus.EXPIRED or o.expiresAt <= :now)))
          and (:keyword is null
            or lower(o.orderCode) like :keyword
            or lower(item.courseTitle) like :keyword)
        """
    )
    Page<CourseOrder> searchUserHistory(
        @Param("userId") Long userId,
        @Param("status") PaymentStatus status,
        @Param("keyword") String keyword,
        @Param("expired") boolean expired,
        @Param("now") Instant now,
        Pageable pageable
    );

    @Query(
        value = """
        select distinct o from CourseOrder o
        left join o.items item
        where (:status is null or exists (
            select p.id from Payment p where p.order = o and p.status = :status
              and (p.status <> com.elearning.payment.entity.enums.PaymentStatus.PENDING
                or p.provider <> com.elearning.payment.entity.enums.PaymentProvider.VNPAY
                or (o.status <> com.elearning.payment.entity.enums.OrderStatus.EXPIRED
                  and (o.expiresAt is null or o.expiresAt > :now)))
          ))
          and (:expired = false or exists (select p.id from Payment p where p.order = o
            and p.provider = com.elearning.payment.entity.enums.PaymentProvider.VNPAY
            and p.status = com.elearning.payment.entity.enums.PaymentStatus.PENDING
            and (o.status = com.elearning.payment.entity.enums.OrderStatus.EXPIRED or o.expiresAt <= :now)))
          and (:keyword is null
            or lower(o.orderCode) like :keyword
            or lower(item.courseTitle) like :keyword)
        """,
        countQuery = """
        select count(distinct o) from CourseOrder o
        left join o.items item
        where (:status is null or exists (
            select p.id from Payment p where p.order = o and p.status = :status
              and (p.status <> com.elearning.payment.entity.enums.PaymentStatus.PENDING
                or p.provider <> com.elearning.payment.entity.enums.PaymentProvider.VNPAY
                or (o.status <> com.elearning.payment.entity.enums.OrderStatus.EXPIRED
                  and (o.expiresAt is null or o.expiresAt > :now)))
          ))
          and (:expired = false or exists (select p.id from Payment p where p.order = o
            and p.provider = com.elearning.payment.entity.enums.PaymentProvider.VNPAY
            and p.status = com.elearning.payment.entity.enums.PaymentStatus.PENDING
            and (o.status = com.elearning.payment.entity.enums.OrderStatus.EXPIRED or o.expiresAt <= :now)))
          and (:keyword is null
            or lower(o.orderCode) like :keyword
            or lower(item.courseTitle) like :keyword)
        """
    )
    Page<CourseOrder> searchAdminOrders(
        @Param("status") PaymentStatus status,
        @Param("keyword") String keyword,
        @Param("expired") boolean expired,
        @Param("now") Instant now,
        Pageable pageable
    );

    @Query("select count(distinct o.userId) from CourseOrder o")
    long countDistinctUsers();

    @Query("select count(distinct item.courseId) from OrderItem item")
    long countDistinctCourses();
}
