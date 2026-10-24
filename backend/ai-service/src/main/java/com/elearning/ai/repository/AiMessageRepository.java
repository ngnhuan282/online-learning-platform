package com.elearning.ai.repository;

import com.elearning.ai.entity.AiMessage;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiMessageRepository extends JpaRepository<AiMessage, Long> {
    Page<AiMessage> findByConversationId(Long conversationId, Pageable pageable);
    List<AiMessage> findByConversationIdAndRequestIdOrderByIdAsc(Long conversationId, String requestId);
}
