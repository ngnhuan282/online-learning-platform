package com.elearning.course;

import static org.junit.jupiter.api.Assertions.*;

import com.elearning.course.dto.LessonRequest;
import com.elearning.course.dto.LessonResponse;
import com.elearning.course.dto.ReorderRequest;
import com.elearning.course.dto.SectionRequest;
import com.elearning.course.dto.SectionResponse;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.Lesson;
import com.elearning.course.entity.LessonType;
import com.elearning.course.entity.Section;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

public class CurriculumFoundationTest {

    @Test
    void shouldCreateSectionAndLessonEntities() {
        Course course = new Course();
        course.setId(10L);
        course.setTitle("Spring Boot Deep Dive");

        Section section = new Section();
        section.setId(1L);
        section.setCourse(course);
        section.setTitle("Chương 1: Mở đầu");
        section.setOrderIndex(0);
        section.setCreatedAt(Instant.now());
        section.setUpdatedAt(Instant.now());

        Lesson lesson = new Lesson();
        lesson.setId(100L);
        lesson.setSection(section);
        lesson.setTitle("Bài 1: Kiến trúc Spring Boot");
        lesson.setLessonType(LessonType.VIDEO);
        lesson.setVideoUrl("https://example.com/video1.mp4");
        lesson.setDuration(600);
        lesson.setOrderIndex(0);
        lesson.setPreview(true);
        lesson.setCreatedAt(Instant.now());
        lesson.setUpdatedAt(Instant.now());

        section.getLessons().add(lesson);

        assertEquals(1L, section.getId());
        assertEquals("Chương 1: Mở đầu", section.getTitle());
        assertEquals(1, section.getLessons().size());
        assertEquals(LessonType.VIDEO, lesson.getLessonType());
        assertTrue(lesson.isPreview());

        // Test static factory from(entity)
        SectionResponse sectionResponse = SectionResponse.from(section);
        assertEquals(1L, sectionResponse.id());
        assertEquals(10L, sectionResponse.courseId());
        assertEquals("Chương 1: Mở đầu", sectionResponse.title());
        assertEquals(1, sectionResponse.lessons().size());

        LessonResponse lessonResponse = sectionResponse.lessons().get(0);
        assertEquals(100L, lessonResponse.id());
        assertEquals(1L, lessonResponse.sectionId());
        assertEquals(LessonType.VIDEO, lessonResponse.lessonType());
        assertEquals(600, lessonResponse.duration());
    }

    @Test
    void shouldHandleReorderRequest() {
        ReorderRequest request = new ReorderRequest(List.of(
            new ReorderRequest.Item(2L, 0),
            new ReorderRequest.Item(1L, 1)
        ));

        assertEquals(2, request.items().size());
        assertEquals(2L, request.items().get(0).id());
        assertEquals(0, request.items().get(0).orderIndex());
    }
}
