package com.elearning.learning.repository;

import com.elearning.learning.entity.Notification;
import java.util.List;
import java.util.Optional;
import java.time.Instant;
import jakarta.persistence.LockModeType;
import com.elearning.learning.entity.enums.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findTop20ByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    List<Notification> findTop5ByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Notification> findByIdAndUserId(Long id, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Notification> findByUserIdAndEventKey(Long userId, String eventKey);

    @Query("""
        select n from Notification n where n.userId = :userId and n.type in :types
        and (:unreadOnly = false or n.readAt is null)
        """)
    Page<Notification> findFeed(
        @Param("userId") Long userId, @Param("types") List<NotificationType> types,
        @Param("unreadOnly") boolean unreadOnly, Pageable pageable
    );

    @Query("""
        select n from Notification n where (:userId is null or n.userId = :userId)
        and n.type in :types and (:unreadOnly = false or n.readAt is null)
        """)
    Page<Notification> findAdminFeed(
        @Param("userId") Long userId, @Param("types") List<NotificationType> types,
        @Param("unreadOnly") boolean unreadOnly, Pageable pageable
    );

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Notification n set n.readAt = :now where n.userId = :userId and n.readAt is null")
    int markAllRead(@Param("userId") Long userId, @Param("now") Instant now);

    long countByUserIdAndReadAtIsNull(Long userId);
}
