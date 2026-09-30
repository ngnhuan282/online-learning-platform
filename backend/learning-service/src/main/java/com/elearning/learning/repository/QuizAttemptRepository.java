package com.elearning.learning.repository;

import com.elearning.learning.entity.QuizAttempt;
import com.elearning.learning.entity.enums.AttemptStatus;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {
    List<QuizAttempt> findTop5ByUserIdAndStatusOrderByIdDesc(Long userId, AttemptStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<QuizAttempt> findTopByUserIdAndQuizIdOrderByIdDesc(Long userId, Long quizId);

    Optional<QuizAttempt> findTopByUserIdAndQuizIdAndStatusOrderByIdDesc(
        Long userId,
        Long quizId,
        AttemptStatus status
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<QuizAttempt> findByIdAndUserId(Long id, Long userId);

    @Query("select attempt from QuizAttempt attempt where attempt.id = :id and attempt.userId = :userId")
    Optional<QuizAttempt> findOwned(@Param("id") Long id, @Param("userId") Long userId);

    boolean existsByQuizId(Long quizId);
}
