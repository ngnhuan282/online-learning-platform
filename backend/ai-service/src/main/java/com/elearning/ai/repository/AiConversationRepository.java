package com.elearning.ai.repository;

import com.elearning.ai.entity.AiConversation;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;

public interface AiConversationRepository extends JpaRepository<AiConversation, Long> {
    Page<AiConversation> findByUserId(Long userId, Pageable pageable);
    Optional<AiConversation> findByIdAndUserId(Long id, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AiConversation c where c.id = :id and c.userId = :userId")
    Optional<AiConversation> findOwnedForUpdate(Long id, Long userId);
}
