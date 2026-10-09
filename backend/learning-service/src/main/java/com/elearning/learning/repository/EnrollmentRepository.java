package com.elearning.learning.repository;

import com.elearning.learning.entity.Enrollment;
import com.elearning.learning.entity.enums.EnrollmentStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    List<Enrollment> findByUserIdOrderByLastAccessedAtDescEnrolledAtDesc(Long userId);

    long countByUserIdAndStatus(Long userId, EnrollmentStatus status);

    Optional<Enrollment> findByUserIdAndCourseId(Long userId, Long courseId);

    Optional<Enrollment> findBySourceOrderCode(String sourceOrderCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Enrollment> findForUpdateByUserIdAndCourseId(Long userId, Long courseId);
}
