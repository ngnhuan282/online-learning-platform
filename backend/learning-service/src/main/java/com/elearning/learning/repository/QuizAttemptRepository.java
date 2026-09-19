package com.elearning.learning.repository;

import com.elearning.learning.entity.QuizAttempt;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {
    List<QuizAttempt> findTop5ByUserIdOrderByStartedAtDesc(Long userId);

    Optional<QuizAttempt> findTopByUserIdAndQuizIdOrderByStartedAtDesc(Long userId, Long quizId);
}
