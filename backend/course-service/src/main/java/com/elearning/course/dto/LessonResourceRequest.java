package com.elearning.course.dto;

import com.elearning.course.entity.ResourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record LessonResourceRequest(
    @NotNull(message = "Resource type is required")
    ResourceType resourceType,

    @NotBlank(message = "Title is required")
    @Size(max = 255, message = "Title must not exceed 255 characters")
    String title,

    @NotBlank(message = "File name is required")
    @Size(max = 255, message = "File name must not exceed 255 characters")
    String fileName,

    long fileSize,

    @Size(max = 100, message = "Content type must not exceed 100 characters")
    String contentType,

    @NotBlank(message = "Object key is required")
    @Size(max = 500, message = "Object key must not exceed 500 characters")
    String objectKey,

    @Size(max = 1000, message = "Download URL must not exceed 1000 characters")
    String downloadUrl
) {}
