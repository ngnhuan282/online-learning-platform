package com.elearning.ai.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "ai_conversations")
@Getter
@Setter
public class AiConversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false, length = 100)
    private String title;

    private Long courseId;
    private Long lessonId;

    @Column(length = 255)
    private String contextTitle;

    @Column(length = 64)
    private String activeRequestId;

    private Instant activeUntil;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;
}
