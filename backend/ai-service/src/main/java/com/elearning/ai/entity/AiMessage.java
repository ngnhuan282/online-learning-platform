package com.elearning.ai.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
    name = "ai_messages",
    uniqueConstraints = @UniqueConstraint(columnNames = { "conversation_id", "request_id", "sender" })
)
@Getter
@Setter
public class AiMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long conversationId;

    @Column(nullable = false, length = 10)
    private String sender;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false, length = 64)
    private String requestId;

    @Column(nullable = false)
    private Instant createdAt;
}
