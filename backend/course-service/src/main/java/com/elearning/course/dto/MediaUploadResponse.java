package com.elearning.course.dto;

public record MediaUploadResponse(
    String objectKey,
    String url,
    String fileName,
    long fileSize,
    String contentType
) {}
