package com.elearning.learning.repository;

import com.elearning.learning.entity.Quiz;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface QuizRepository extends JpaRepository<Quiz, Long> {
    List<Quiz> findByCourseIdAndPublishedTrueOrderByIdAsc(Long courseId);

    List<Quiz> findAllByOrderByIdDesc();

    @EntityGraph(attributePaths = "questions")
    Optional<Quiz> findWithQuestionsById(Long id);

    @EntityGraph(attributePaths = "questions")
    Optional<Quiz> findWithQuestionsByIdAndPublishedTrue(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Quiz> findForUpdateById(Long id);
}
