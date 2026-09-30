package com.elearning.learning.repository;

import com.elearning.learning.entity.Quiz;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuizRepository extends JpaRepository<Quiz, Long> {
    List<Quiz> findByCourseIdAndPublishedTrueOrderByIdAsc(Long courseId);

    List<Quiz> findAllByOrderByIdDesc();

    @EntityGraph(attributePaths = "questions")
    Optional<Quiz> findWithQuestionsById(Long id);

    @EntityGraph(attributePaths = "questions")
    Optional<Quiz> findWithQuestionsByIdAndPublishedTrue(Long id);
}
