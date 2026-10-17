package com.elearning.auth.dto;

import com.elearning.auth.validation.Utf8Size;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
    @NotBlank @Size(max = 128) @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) String token,
    @NotBlank
    @Size(min = 8, max = 72)
    @Pattern(
        regexp = "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).*",
        message = "Mật khẩu mới phải có chữ hoa, chữ thường và chữ số"
    )
    @Utf8Size(max = 72)
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY)
    String newPassword,
    @NotBlank
    @Size(max = 72)
    @Utf8Size(max = 72)
    @Schema(accessMode = Schema.AccessMode.WRITE_ONLY)
    String confirmPassword
) {
    @AssertTrue(message = "Mật khẩu xác nhận chưa khớp")
    public boolean isPasswordConfirmed() {
        return newPassword == null || confirmPassword == null || newPassword.equals(confirmPassword);
    }

    @Override
    public String toString() {
        return "ResetPasswordRequest[redacted]";
    }
}
