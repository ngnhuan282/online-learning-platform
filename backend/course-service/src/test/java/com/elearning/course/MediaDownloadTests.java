package com.elearning.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.controller.MediaController;
import com.elearning.course.integration.storage.StorageService;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.security.CourseContentAccess;
import com.elearning.course.security.MediaTickets;
import java.net.URI;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mock.web.MockHttpServletRequest;

class MediaDownloadTests {

    final StorageService storage = mock(StorageService.class);
    final CourseRepository courses = mock(CourseRepository.class);
    final CourseContentAccess access = mock(CourseContentAccess.class);
    final MediaTickets tickets = new MediaTickets("test-secret-with-at-least-32-characters");
    final MediaController controller = new MediaController(storage, courses, access, tickets);

    void storedFile() {
        when(storage.getDownloadUrl("videos/lesson.mp4")).thenReturn("/api/v1/media/download/videos/lesson.mp4");
        when(storage.loadAsResource("videos/lesson.mp4")).thenReturn(new ByteArrayResource(new byte[] {1, 2}));
    }

    @Test
    void curriculumAndUploadTicketsRemainDownloadableAfterMerge() {
        storedFile();
        var url = URI.create(tickets.signLocalUrl("/api/v1/media/download/videos/lesson.mp4"));
        var request = new MockHttpServletRequest();
        for (String pair : url.getQuery().split("&")) {
            String[] parts = pair.split("=", 2);
            request.setParameter(parts[0], parts[1]);
        }
        var response = controller.downloadLocal("videos", "lesson.mp4",
            Long.valueOf(request.getParameter("expires")), null, request);
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isInstanceOf(ByteArrayResource.class);
        verify(storage, never()).verifySignedToken(anyString(), any(), any());
    }

    @Test
    void playEndpointStorageTokensAlsoRemainDownloadable() {
        storedFile();
        when(storage.verifySignedToken("videos/lesson.mp4", 9999999999999L, "valid-storage-token")).thenReturn(true);
        var response = controller.downloadLocal("videos", "lesson.mp4", 9999999999999L,
            "valid-storage-token", new MockHttpServletRequest());
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void removingOrTamperingWithSignatureNeverGrantsPrivateDownload() {
        assertThatThrownBy(() -> controller.downloadLocal("videos", "lesson.mp4", null, null,
            new MockHttpServletRequest())).hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
        assertThatThrownBy(() -> controller.downloadLocal("videos", "lesson.mp4", 9999999999999L,
            "invalid-token", new MockHttpServletRequest()))
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
        verify(storage, never()).loadAsResource(anyString());
    }
}
