package com.elearning.course.repository;

import com.elearning.course.entity.LessonResource;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LessonResourceRepository extends JpaRepository<LessonResource, Long> {

    List<LessonResource> findByLessonIdOrderByCreatedAtAsc(Long lessonId);
}
