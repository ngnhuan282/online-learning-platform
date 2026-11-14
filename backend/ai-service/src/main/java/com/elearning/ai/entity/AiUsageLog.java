package com.elearning.ai.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "ai_usage_logs")
@Getter
@Setter
public class AiUsageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Long conversationId;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(nullable = false, length = 40)
    private String outcome;

    private int inputTokens;
    private int outputTokens;

    @Column(nullable = false)
    private Instant createdAt;
}
