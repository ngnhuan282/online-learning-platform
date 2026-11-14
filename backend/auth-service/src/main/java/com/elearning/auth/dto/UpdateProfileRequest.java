package com.elearning.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PastOrPresent;
import java.time.LocalDate;

public record UpdateProfileRequest(
    @NotBlank(message = "Họ và tên không được để trống")
    @Size(min = 2, max = 100, message = "Họ và tên phải có từ 2 đến 100 ký tự")
    String fullName,
    @Size(max = 500) @Pattern(regexp = "^$|https?://[^\\s]+", message = "Avatar phải là URL HTTP hoặc HTTPS")
    String avatarUrl,
    @Size(max = 25) @Pattern(regexp = "^$|[+0-9() .-]{6,25}", message = "Số điện thoại không hợp lệ")
    String phone,
    @PastOrPresent(message = "Ngày sinh không được ở tương lai") LocalDate dateOfBirth,
    @Size(max = 1000) String biography
) {
    public UpdateProfileRequest(String fullName) {
        this(fullName, null, null, null, null);
    }
}
