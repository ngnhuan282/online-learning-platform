package com.elearning.learning.entity;

import com.elearning.learning.entity.enums.ProgressStatus;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
    name = "lesson_progress",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_lesson_progress_user_lesson",
        columnNames = { "user_id", "lesson_id" }
    )
)
public class LessonProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "course_id", nullable = false)
    private Long courseId;

    @Column(name = "lesson_id", nullable = false)
    private Long lessonId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ProgressStatus status = ProgressStatus.NOT_STARTED;

    @Column(name = "progress_percent", nullable = false)
    private Integer progressPercent = 0;

    @Column(name = "time_spent_seconds", nullable = false)
    private Long timeSpentSeconds = 0L;

    @Column(name = "first_accessed_at", nullable = false)
    private Instant firstAccessedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (firstAccessedAt == null) {
            firstAccessedAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
