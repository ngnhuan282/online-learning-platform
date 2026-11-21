package com.elearning.course.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.dto.LessonResourceRequest;
import com.elearning.course.entity.*;
import com.elearning.course.integration.storage.StorageService;
import com.elearning.course.repository.*;
import com.elearning.course.security.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class LessonResourceServiceTests {
    final LessonResourceRepository resources = mock(LessonResourceRepository.class);
    final LessonRepository lessons = mock(LessonRepository.class);
    final StorageService storage = mock(StorageService.class);
    final CourseContentAccess access = mock(CourseContentAccess.class);
    final MediaTickets tickets = new MediaTickets("resource-test-secret-at-least-32-bytes");
    final LessonResourceService service = new LessonResourceService(resources, lessons, storage, access, tickets);

    @Test
    void listResources_whenCallerHasLessonAccess_shouldReturnSignedStorageUrls() {
        // Arrange
        var lesson = new Lesson(); lesson.setId(5L);
        when(lessons.findById(5L)).thenReturn(Optional.of(lesson));
        var resource = new LessonResource(); resource.setId(8L); resource.setObjectKey("docs/lesson.pdf");
        when(resources.findByLessonIdOrderByCreatedAtAsc(5L)).thenReturn(List.of(resource));
        when(storage.getDownloadUrl(resource.getObjectKey())).thenReturn("/api/v1/media/download/docs/lesson.pdf");
        var response = service.getResourcesByLesson(5L).getFirst();
        // Act
        assertThat(response.lessonId()).isEqualTo(5L);
        assertThat(response.downloadUrl()).contains("?expires=", "&signature=");
        verify(access).requireLesson(lesson);
        doThrow(new AppException(com.elearning.course.common.exception.ErrorCode.FORBIDDEN)).when(access).requireLesson(lesson);
        // Assert
        assertThatThrownBy(() -> service.getResourcesByLesson(5L)).isInstanceOf(AppException.class);
    }

    @Test
    void create_whenMetadataHasWhitespace_shouldTrimValuesAndUseServerDownloadPath() {
        // Arrange
        var lesson = new Lesson(); lesson.setId(5L);
        when(lessons.findById(5L)).thenReturn(Optional.of(lesson));
        when(resources.save(any())).thenAnswer(call -> call.getArgument(0));
        var request = new LessonResourceRequest(ResourceType.PDF, " Notes ", " notes.pdf ", 12, "application/pdf", " docs/notes.pdf ", "https://untrusted.test");
        // Act
        var result = service.addResource(5L, request);

        // Assert
        assertThat(result.title()).isEqualTo("Notes");
        assertThat(result.fileName()).isEqualTo("notes.pdf");
        assertThat(result.objectKey()).isEqualTo("docs/notes.pdf");
        assertThat(result.downloadUrl()).isEqualTo("/api/v1/media/download/docs/notes.pdf");
        assertThat(result.fileSize()).isEqualTo(12);
    }

    @Test
    void delete_whenStorageDeletionFails_shouldPreserveResourceMetadata() {
        // Arrange
        var resource = new LessonResource(); resource.setObjectKey("docs/a.pdf");
        when(resources.findById(8L)).thenReturn(Optional.of(resource));
        service.deleteResource(8L);
        var sequence = inOrder(storage, resources);
        // Act
        sequence.verify(storage).delete("docs/a.pdf");
        sequence.verify(resources).delete(resource);
        clearInvocations(resources, storage);
        doThrow(new IllegalStateException("storage unavailable")).when(storage).delete("docs/a.pdf");
        // Assert
        assertThatThrownBy(() -> service.deleteResource(8L)).isInstanceOf(IllegalStateException.class);
        verify(resources, never()).delete(any());
    }

    @Test
    void loadResource_whenLessonOrResourceIsMissing_shouldAvoidStorageSideEffects() {
        // Arrange
        // Act
        var thrown = catchThrowable(() -> service.getResourcesByLesson(99L));

        // Assert
        assertThat(thrown).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.addResource(99L, null)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.deleteResource(99L)).isInstanceOf(AppException.class);
        verifyNoInteractions(storage, access);
    }
}
