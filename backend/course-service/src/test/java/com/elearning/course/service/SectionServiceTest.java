package com.elearning.course.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.ReorderRequest;
import com.elearning.course.dto.SectionRequest;
import com.elearning.course.dto.SectionResponse;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.Section;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.repository.SectionRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SectionServiceTest {

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private CourseRepository courseRepository;

    @InjectMocks
    private SectionService sectionService;

    private Course course;
    private Section section;

    @BeforeEach
    void setUp() {
        course = new Course();
        course.setId(1L);
        course.setTitle("Demo Course");

        section = new Section();
        section.setId(10L);
        section.setCourse(course);
        section.setTitle("Chapter 1: Intro");
        section.setOrderIndex(0);
        section.setCreatedAt(Instant.now());
        section.setUpdatedAt(Instant.now());
        section.setLessons(new ArrayList<>());
    }

    @Test
    void listByCourse_success() {
        when(courseRepository.findById(1L)).thenReturn(Optional.of(course));
        when(sectionRepository.findByCourseIdWithLessons(1L)).thenReturn(List.of(section));

        List<SectionResponse> result = sectionService.listByCourse(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).title()).isEqualTo("Chapter 1: Intro");
        assertThat(result.get(0).courseId()).isEqualTo(1L);
    }

    @Test
    void listByCourse_courseNotFound_throwsAppException() {
        when(courseRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sectionService.listByCourse(99L))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    void create_success() {
        SectionRequest req = new SectionRequest("Chapter 2: Setup", 1);
        when(courseRepository.findById(1L)).thenReturn(Optional.of(course));
        when(sectionRepository.save(any(Section.class))).thenAnswer(i -> {
            Section s = i.getArgument(0);
            s.setId(11L);
            s.setCreatedAt(Instant.now());
            s.setUpdatedAt(Instant.now());
            s.setLessons(new ArrayList<>());
            return s;
        });

        SectionResponse resp = sectionService.create(1L, req);

        assertThat(resp).isNotNull();
        assertThat(resp.id()).isEqualTo(11L);
        assertThat(resp.title()).isEqualTo("Chapter 2: Setup");
        assertThat(resp.orderIndex()).isEqualTo(1);
    }

    @Test
    void update_success() {
        SectionRequest req = new SectionRequest("Chapter 1: Updated", 0);
        when(sectionRepository.findById(10L)).thenReturn(Optional.of(section));
        when(sectionRepository.save(any(Section.class))).thenAnswer(i -> i.getArgument(0));

        SectionResponse resp = sectionService.update(1L, 10L, req);

        assertThat(resp.title()).isEqualTo("Chapter 1: Updated");
    }

    @Test
    void update_wrongCourseId_throwsAppException() {
        SectionRequest req = new SectionRequest("Chapter 1: Updated", 0);
        when(sectionRepository.findById(10L)).thenReturn(Optional.of(section));

        assertThatThrownBy(() -> sectionService.update(999L, 10L, req))
            .isInstanceOf(AppException.class)
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
    }

    @Test
    void delete_success() {
        when(sectionRepository.findById(10L)).thenReturn(Optional.of(section));

        sectionService.delete(1L, 10L);

        verify(sectionRepository).delete(section);
    }

    @Test
    void reorder_success() {
        Section sec2 = new Section();
        sec2.setId(20L);
        sec2.setCourse(course);
        sec2.setTitle("Chapter 2");
        sec2.setOrderIndex(1);
        sec2.setLessons(new ArrayList<>());

        when(courseRepository.findById(1L)).thenReturn(Optional.of(course));
        when(sectionRepository.findByCourseIdOrderByOrderIndexAsc(1L)).thenReturn(List.of(section, sec2));

        ReorderRequest reorderReq = new ReorderRequest(List.of(
            new ReorderRequest.Item(10L, 1),
            new ReorderRequest.Item(20L, 0)
        ));

        sectionService.reorder(1L, reorderReq);

        assertThat(section.getOrderIndex()).isEqualTo(1);
        assertThat(sec2.getOrderIndex()).isEqualTo(0);
        verify(sectionRepository).saveAll(any());
    }
}
