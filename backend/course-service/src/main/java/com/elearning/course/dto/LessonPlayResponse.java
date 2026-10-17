package com.elearning.course.dto;

import com.elearning.course.entity.LessonType;

public record LessonPlayResponse(
    Long lessonId,
    String title,
    LessonType lessonType,
    String playUrl,
    int expiresInSeconds,
    boolean preview,
    String content,
    Integer duration
) {}
