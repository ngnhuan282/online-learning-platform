package com.elearning.learning.repository;

import com.elearning.learning.entity.Enrollment;
import com.elearning.learning.entity.enums.EnrollmentStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    List<Enrollment> findByUserIdOrderByLastAccessedAtDescEnrolledAtDesc(Long userId);

    long countByUserIdAndStatus(Long userId, EnrollmentStatus status);

    Optional<Enrollment> findByUserIdAndCourseId(Long userId, Long courseId);
}
