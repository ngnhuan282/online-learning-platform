package com.elearning.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.controller.MediaController;
import com.elearning.course.dto.MediaUploadResponse;
import com.elearning.course.entity.CourseStatus;
import com.elearning.course.integration.storage.StorageService;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.security.CourseContentAccess;
import com.elearning.course.security.MediaTickets;
import java.net.URI;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockMultipartFile;

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
    void downloadLocal_whenCurriculumOrUploadTicketIsValid_shouldReturnStoredMedia() {
        // Arrange
        storedFile();
        var url = URI.create(tickets.signLocalUrl("/api/v1/media/download/videos/lesson.mp4"));
        var request = new MockHttpServletRequest();
        for (String pair : url.getQuery().split("&")) {
            String[] parts = pair.split("=", 2);
            request.setParameter(parts[0], parts[1]);
        }
        // Act
        var response = controller.downloadLocal("videos", "lesson.mp4",
            Long.valueOf(request.getParameter("expires")), null, request);
        // Assert
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isInstanceOf(ByteArrayResource.class);
        verify(storage, never()).verifySignedToken(anyString(), any(), any());
    }

    @Test
    void downloadLocal_whenPlayEndpointTokenIsValid_shouldReturnStoredMedia() {
        // Arrange
        storedFile();
        when(storage.verifySignedToken("videos/lesson.mp4", 9999999999999L, "valid-storage-token")).thenReturn(true);
        // Act
        var response = controller.downloadLocal("videos", "lesson.mp4", 9999999999999L,
            "valid-storage-token", new MockHttpServletRequest());
        // Assert
        assertThat(response.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void downloadLocal_whenThumbnailBelongsToPublishedCourse_shouldRedirectGuestToStorage() {
        // Arrange
        String objectKey = "thumbnails/cover.png";
        String url = "https://media.example.test/" + objectKey;
        var request = new MockHttpServletRequest();
        when(courses.existsByThumbnailUrlAndStatus(MediaTickets.DOWNLOAD_PREFIX + objectKey, CourseStatus.PUBLISHED))
            .thenReturn(true);
        when(storage.getDownloadUrl(objectKey)).thenReturn(url);

        // Act
        var response = controller.downloadLocal("thumbnails", "cover.png", null, null, request);

        // Assert
        assertThat(response.getStatusCode().value()).isEqualTo(302);
        assertThat(response.getHeaders().getLocation()).isEqualTo(URI.create(url));
        verify(storage, never()).loadAsResource(objectKey);
    }

    @Test
    void upload_whenFileIsStoredLocally_shouldReturnSignedUrlAndMetadata() {
        // Arrange
        var file = new MockMultipartFile("file", "lesson.mp4", "video/mp4", new byte[] { 1, 2 });
        String objectKey = "videos/lesson.mp4";
        String url = MediaTickets.DOWNLOAD_PREFIX + objectKey;
        when(storage.upload(file, "videos"))
            .thenReturn(new MediaUploadResponse(objectKey, url, "lesson.mp4", 2L, "video/mp4"));

        // Act
        var response = controller.upload(file, "videos").data();

        // Assert
        assertThat(response.objectKey()).isEqualTo(objectKey);
        assertThat(response.fileName()).isEqualTo("lesson.mp4");
        assertThat(response.fileSize()).isEqualTo(2L);
        assertThat(response.contentType()).isEqualTo("video/mp4");
        assertThat(response.url()).startsWith(url + "?").contains("expires=", "signature=");
    }

    @Test
    void downloadLocal_whenSignatureIsMissingOrTampered_shouldDenyPrivateDownload() {
        // Arrange
        // Act
        var thrown = catchThrowable(() -> controller.downloadLocal("videos", "lesson.mp4", null, null,
            new MockHttpServletRequest()));

        // Assert
        assertThat(thrown).hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
        assertThatThrownBy(() -> controller.downloadLocal("videos", "lesson.mp4", 9999999999999L,
            "invalid-token", new MockHttpServletRequest()))
            .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
        verify(storage, never()).loadAsResource(anyString());
    }
}
