package com.elearning.auth.dto;

import com.elearning.auth.validation.Utf8Size;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
    @NotBlank(message = "Mật khẩu hiện tại không được để trống")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) String currentPassword,

    @NotBlank(message = "Mật khẩu mới không được để trống")
    @Size(min = 8, max = 72, message = "Mật khẩu mới phải có từ 8 đến 72 ký tự")
    @Pattern(
        regexp = "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).*",
        message = "Mật khẩu mới phải có chữ hoa, chữ thường và chữ số"
    )
    @Utf8Size(max = 72, message = "Mật khẩu không được vượt quá 72 byte UTF-8")
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) String newPassword
) {
    @Override
    public String toString() {
        return "ChangePasswordRequest[redacted]";
    }
}
