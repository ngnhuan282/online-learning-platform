package com.elearning.course.dto;

import com.elearning.course.entity.CourseLevel;
import com.elearning.course.entity.CourseStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CourseRequest(
    @NotBlank(message = "Course title is required")
    @Size(max = 200, message = "Course title must not exceed 200 characters")
    String title,
    @NotBlank(message = "Course description is required")
    @Size(max = 2000, message = "Course description must not exceed 2000 characters")
    String description,
    @NotNull(message = "Category is required")
    Long categoryId,
    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.00", inclusive = true, message = "Price must be greater than or equal to 0")
    BigDecimal price,
    BigDecimal originalPrice,
    CourseLevel level,
    CourseStatus status,
    String thumbnailUrl
) {}
