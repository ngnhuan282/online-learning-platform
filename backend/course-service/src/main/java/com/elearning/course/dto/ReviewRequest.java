package com.elearning.course.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record ReviewRequest(
    @Min(value = 1, message = "Rating phải từ 1 đến 5")
    @Max(value = 5, message = "Rating phải từ 1 đến 5")
    int rating,

    @Size(max = 2000, message = "Nhận xét không quá 2000 ký tự")
    String comment,

    @Size(max = 150)
    String userFullName
) {
    public ReviewRequest(int rating, String comment) {
        this(rating, comment, null);
    }
}
