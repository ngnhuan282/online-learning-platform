package com.elearning.learning.entity;

import com.elearning.learning.entity.enums.EnrollmentStatus;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
    name = "enrollments",
    uniqueConstraints = @UniqueConstraint(name = "uk_enrollments_user_course", columnNames = { "user_id", "course_id" })
)
public class Enrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "course_id", nullable = false)
    private Long courseId;

    @Column(name = "source_order_code", unique = true, length = 40)
    private String sourceOrderCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EnrollmentStatus status = EnrollmentStatus.ACTIVE;

    @Column(name = "enrolled_at", nullable = false)
    private Instant enrolledAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "last_accessed_at")
    private Instant lastAccessedAt;

    @PrePersist
    void prePersist() {
        if (enrolledAt == null) {
            enrolledAt = Instant.now();
        }
    }
}
