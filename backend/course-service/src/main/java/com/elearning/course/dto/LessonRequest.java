package com.elearning.course.dto;

import com.elearning.course.entity.LessonType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record LessonRequest(
    @NotBlank(message = "Lesson title is required")
    @Size(max = 255, message = "Lesson title must not exceed 255 characters")
    String title,

    @NotNull(message = "Lesson type is required")
    LessonType lessonType,

    String content,

    @Size(max = 500, message = "Video URL must not exceed 500 characters")
    String videoUrl,

    @Min(value = 0, message = "Duration must be >= 0")
    Integer duration,

    @Min(value = 0, message = "Order index must be >= 0")
    int orderIndex,

    boolean preview
) {}
