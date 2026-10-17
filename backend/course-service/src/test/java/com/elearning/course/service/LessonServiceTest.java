package com.elearning.course.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.LessonRequest;
import com.elearning.course.dto.LessonResponse;
import com.elearning.course.dto.ReorderRequest;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.Lesson;
import com.elearning.course.entity.LessonType;
import com.elearning.course.entity.Section;
import com.elearning.course.repository.LessonRepository;
import com.elearning.course.repository.SectionRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LessonServiceTest {

    @Mock
    private LessonRepository lessonRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private com.elearning.course.integration.storage.StorageService storageService;

    @Mock
    private com.elearning.course.integration.learning.EnrollmentClient enrollmentClient;

    @InjectMocks
    private LessonService lessonService;

    private Section section;
    private Lesson lesson;

    @BeforeEach
    void setUp() {
        Course course = new Course();
        course.setId(1L);

        section = new Section();
        section.setId(10L);
        section.setCourse(course);
        section.setTitle("Chapter 1");

        lesson = new Lesson();
        lesson.setId(100L);
        lesson.setSection(section);
        lesson.setTitle("Intro to Java");
        lesson.setLessonType(LessonType.TEXT);
        lesson.setContent("Hello World");
        lesson.setOrderIndex(0);
        lesson.setCreatedAt(Instant.now());
        lesson.setUpdatedAt(Instant.now());
    }

    @Test
    void create_videoLessonWithoutUrl_throwsBadRequest() {
        LessonRequest req = new LessonRequest(
            "Video Lesson",
            LessonType.VIDEO,
            null,
            null, // videoUrl is null!
            120,
            0,
            false
        );

        when(sectionRepository.findById(10L)).thenReturn(Optional.of(section));

        assertThatThrownBy(() -> lessonService.create(10L, req))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.BAD_REQUEST);
    }

    @Test
    void create_sectionNotFound_throwsNotFound() {
        LessonRequest req = new LessonRequest(
            "Text Lesson",
            LessonType.TEXT,
            "Content",
            null,
            60,
            0,
            false
        );

        when(sectionRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> lessonService.create(99L, req))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    void create_success() {
        LessonRequest req = new LessonRequest(
            "Video Lesson",
            LessonType.VIDEO,
            null,
            "https://cdn.example.com/video.mp4",
            300,
            1,
            true
        );

        when(sectionRepository.findById(10L)).thenReturn(Optional.of(section));
        when(lessonRepository.save(any(Lesson.class))).thenAnswer(i -> {
            Lesson l = i.getArgument(0);
            l.setId(101L);
            l.setCreatedAt(Instant.now());
            l.setUpdatedAt(Instant.now());
            return l;
        });

        LessonResponse resp = lessonService.create(10L, req);

        assertThat(resp).isNotNull();
        assertThat(resp.id()).isEqualTo(101L);
        assertThat(resp.title()).isEqualTo("Video Lesson");
        assertThat(resp.lessonType()).isEqualTo(LessonType.VIDEO);
        assertThat(resp.videoUrl()).isEqualTo("https://cdn.example.com/video.mp4");
        assertThat(resp.preview()).isTrue();
    }

    @Test
    void update_success() {
        LessonRequest req = new LessonRequest(
            "Intro to Java Updated",
            LessonType.TEXT,
            "Updated content",
            null,
            180,
            0,
            false
        );

        when(lessonRepository.findById(100L)).thenReturn(Optional.of(lesson));
        when(lessonRepository.save(any(Lesson.class))).thenAnswer(i -> i.getArgument(0));

        LessonResponse resp = lessonService.update(100L, req);

        assertThat(resp.title()).isEqualTo("Intro to Java Updated");
        assertThat(resp.content()).isEqualTo("Updated content");
    }

    @Test
    void delete_success() {
        when(lessonRepository.findById(100L)).thenReturn(Optional.of(lesson));

        lessonService.delete(100L);

        verify(lessonRepository).delete(lesson);
    }

    @Test
    void reorder_success() {
        Lesson lesson2 = new Lesson();
        lesson2.setId(200L);
        lesson2.setSection(section);
        lesson2.setTitle("Lesson 2");
        lesson2.setOrderIndex(1);

        when(sectionRepository.findById(10L)).thenReturn(Optional.of(section));
        when(lessonRepository.findBySectionIdOrderByOrderIndexAsc(10L)).thenReturn(List.of(lesson, lesson2));

        ReorderRequest req = new ReorderRequest(List.of(
            new ReorderRequest.Item(100L, 1),
            new ReorderRequest.Item(200L, 0)
        ));

        lessonService.reorder(10L, req);

        assertThat(lesson.getOrderIndex()).isEqualTo(1);
        assertThat(lesson2.getOrderIndex()).isEqualTo(0);
        verify(lessonRepository).saveAll(any());
    }

    @Test
    void getPlayUrl_previewLesson_successWithoutAuth() {
        lesson.setPreview(true);
        lesson.setLessonType(LessonType.VIDEO);
        lesson.setVideoUrl("videos/sample.mp4");
        when(lessonRepository.findById(100L)).thenReturn(Optional.of(lesson));
        when(storageService.generatePresignedUrl(eq("videos/sample.mp4"), any())).thenReturn("https://s3.amazonaws.com/signed-url");

        var response = lessonService.getPlayUrl(1L, 100L, null, false);

        assertThat(response).isNotNull();
        assertThat(response.preview()).isTrue();
        assertThat(response.playUrl()).isEqualTo("https://s3.amazonaws.com/signed-url");
    }

    @Test
    void getPlayUrl_privateLesson_unauthenticated_throwsUnauthorized() {
        lesson.setPreview(false);
        when(lessonRepository.findById(100L)).thenReturn(Optional.of(lesson));

        assertThatThrownBy(() -> lessonService.getPlayUrl(1L, 100L, null, false))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.UNAUTHORIZED);
    }

    @Test
    void getPlayUrl_privateLesson_notEnrolled_throwsForbidden() {
        lesson.setPreview(false);
        when(lessonRepository.findById(100L)).thenReturn(Optional.of(lesson));
        when(enrollmentClient.isEnrolled(42L, 1L)).thenReturn(false);

        assertThatThrownBy(() -> lessonService.getPlayUrl(1L, 100L, 42L, false))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
    }

    @Test
    void getPlayUrl_privateLesson_enrolled_returnsPresignedUrl() {
        lesson.setPreview(false);
        lesson.setLessonType(LessonType.VIDEO);
        lesson.setVideoUrl("videos/private.mp4");
        when(lessonRepository.findById(100L)).thenReturn(Optional.of(lesson));
        when(enrollmentClient.isEnrolled(42L, 1L)).thenReturn(true);
        when(storageService.generatePresignedUrl(eq("videos/private.mp4"), any())).thenReturn("https://s3.amazonaws.com/private-signed-url");

        var response = lessonService.getPlayUrl(1L, 100L, 42L, false);

        assertThat(response).isNotNull();
        assertThat(response.preview()).isFalse();
        assertThat(response.playUrl()).isEqualTo("https://s3.amazonaws.com/private-signed-url");
    }

    @Test
    void getPlayUrl_privateLesson_admin_bypassesEnrollmentCheck() {
        lesson.setPreview(false);
        lesson.setLessonType(LessonType.VIDEO);
        lesson.setVideoUrl("videos/private.mp4");
        when(lessonRepository.findById(100L)).thenReturn(Optional.of(lesson));
        when(storageService.generatePresignedUrl(eq("videos/private.mp4"), any())).thenReturn("https://s3.amazonaws.com/admin-signed-url");

        var response = lessonService.getPlayUrl(1L, 100L, 999L, true);

        assertThat(response).isNotNull();
        assertThat(response.playUrl()).isEqualTo("https://s3.amazonaws.com/admin-signed-url");
        verify(enrollmentClient, never()).isEnrolled(anyLong(), anyLong());
    }

    @Test
    void getPlayUrl_wrongCourseId_throwsNotFound() {
        when(lessonRepository.findById(100L)).thenReturn(Optional.of(lesson));

        assertThatThrownBy(() -> lessonService.getPlayUrl(999L, 100L, 42L, false))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }
}
