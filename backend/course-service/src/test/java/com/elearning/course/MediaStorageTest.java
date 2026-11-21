package com.elearning.course;

import static org.junit.jupiter.api.Assertions.*;

import com.elearning.course.dto.LessonResourceResponse;
import com.elearning.course.dto.MediaUploadResponse;
import com.elearning.course.entity.Lesson;
import com.elearning.course.entity.LessonResource;
import com.elearning.course.entity.ResourceType;
import com.elearning.course.integration.storage.AwsS3StorageService;
import com.elearning.course.integration.storage.LocalStorageService;
import com.elearning.course.integration.storage.StorageConfig;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockMultipartFile;

public class MediaStorageTest {

    private Path tempDir;
    private LocalStorageService storageService;

    @BeforeEach
    void setUp() throws IOException {
        tempDir = Files.createTempDirectory("test-media-uploads");
        storageService = new LocalStorageService(tempDir.toString());
    }

    @AfterEach
    void tearDown() throws IOException {
        if (tempDir != null && Files.exists(tempDir)) {
            // cleanup files
            try (var stream = Files.walk(tempDir)) {
                stream.sorted((a, b) -> b.compareTo(a)).forEach(p -> {
                    try {
                        Files.deleteIfExists(p);
                    } catch (IOException ignored) {
                    }
                });
            }
        }
    }

    @Test
    void upload_whenLocalStorageIsConfigured_shouldStoreAndReadFile() throws IOException {
        // Arrange
        byte[] content = "Hello E-Learning Media!".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "document.pdf",
                "application/pdf",
                content);

        // Act
        MediaUploadResponse response = storageService.upload(file, "documents");

        assertNotNull(response);
        assertNotNull(response.objectKey());
        assertTrue(response.objectKey().startsWith("documents/"));
        assertEquals("document.pdf", response.fileName());
        assertEquals(content.length, response.fileSize());
        assertEquals("application/pdf", response.contentType());
        assertTrue(response.url().contains(response.objectKey()));

        // Test loading as Resource
        Resource resource = storageService.loadAsResource(response.objectKey());
        assertTrue(resource.exists());
        assertEquals(content.length, resource.contentLength());

        // Test delete
        storageService.delete(response.objectKey());
        // Assert
        assertFalse(Files.exists(tempDir.resolve(response.objectKey())));
    }

    @Test
    void toResponse_whenLessonResourceExists_shouldMapResourceFields() {
        // Arrange
        Lesson lesson = new Lesson();
        lesson.setId(55L);
        lesson.setTitle("Bài học mẫu");

        LessonResource resource = new LessonResource();
        resource.setId(10L);
        resource.setLesson(lesson);
        resource.setResourceType(ResourceType.PDF);
        resource.setTitle("Slide bài giảng");
        resource.setFileName("slide1.pdf");
        resource.setFileSize(204800);
        resource.setContentType("application/pdf");
        resource.setObjectKey("documents/slide1.pdf");
        resource.setDownloadUrl("/api/v1/media/download/documents/slide1.pdf");

        // Act
        LessonResourceResponse response = LessonResourceResponse.from(resource);

        // Assert
        assertEquals(10L, response.id());
        assertEquals(55L, response.lessonId());
        assertEquals(ResourceType.PDF, response.resourceType());
        assertEquals("Slide bài giảng", response.title());
        assertEquals("slide1.pdf", response.fileName());
        assertEquals(204800, response.fileSize());
        assertEquals("documents/slide1.pdf", response.objectKey());
    }

    @Test
    void configureS3_whenCustomEndpointAndPathStyleAreSet_shouldUseConfiguredClientOptions() {
        // Arrange
        // Act
        AwsS3StorageService service = new AwsS3StorageService(
                "demo-bucket",
                "ap-southeast-1",
                "access-key",
                "secret-key",
                "http://localhost:9000",
                true,
                "http://localhost:9000");

        // Assert
        assertEquals("http://localhost:9000", service.getEndpointUrl());
        assertTrue(service.isPathStyleEnabled());
    }

    @Test
    void getDownloadUrl_whenPublicEndpointIsConfigured_shouldSignUsingPublicEndpoint() {
        // Arrange
        AwsS3StorageService service = new AwsS3StorageService(
                "demo-bucket",
                "us-east-1",
                "access-key",
                "secret-key",
                "http://rustfs:9000",
                true,
                "http://localhost:9000");

        // Act
        String downloadUrl = service.generatePresignedUrl("videos/sample.mp4", Duration.ofMinutes(15));

        // Assert
        assertEquals("http://rustfs:9000", service.getEndpointUrl());
        assertEquals("http://localhost:9000", service.getPublicEndpointUrl());
        assertEquals("localhost", URI.create(downloadUrl).getHost());
    }

    @Test
    void configureS3_whenBucketIsMissing_shouldRejectS3Mode() {
        // Arrange
        StorageConfig config = new StorageConfig();
        AwsS3StorageService s3Storage = new AwsS3StorageService(
                "", "us-east-1", "access-key", "secret-key", "", false, "");

        // Act
        IllegalStateException error = assertThrows(
                IllegalStateException.class,
                () -> config.storageService("s3", "", storageService, s3Storage));

        // Assert
        assertTrue(error.getMessage().contains("AWS_S3_BUCKET"));
    }

    @Test
    void getDownloadUrl_whenS3BucketIsMissing_shouldRejectPresignRequest() {
        // Arrange
        // Act
        AwsS3StorageService s3Storage = new AwsS3StorageService(
                "", "us-east-1", "access-key", "secret-key", "", false, "");

        // Assert
        assertThrows(
                com.elearning.course.common.exception.AppException.class,
                () -> s3Storage.generatePresignedUrl("videos/sample.mp4", Duration.ofMinutes(15)));
    }
}
