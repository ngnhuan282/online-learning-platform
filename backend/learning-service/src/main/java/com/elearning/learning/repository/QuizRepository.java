package com.elearning.learning.repository;

import com.elearning.learning.entity.Quiz;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuizRepository extends JpaRepository<Quiz, Long> {
    @EntityGraph(attributePaths = { "questions", "questions.options" })
    Optional<Quiz> findWithQuestionsByIdAndPublishedTrue(Long id);
}
