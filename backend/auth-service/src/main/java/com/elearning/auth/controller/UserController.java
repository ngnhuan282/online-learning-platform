package com.elearning.auth.controller;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.dto.ChangePasswordRequest;
import com.elearning.auth.dto.UpdateProfileRequest;
import com.elearning.auth.dto.UserResponse;
import com.elearning.auth.service.AuthService;
import com.elearning.auth.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Profile", description = "Bearer-authenticated operations on the current user only")
public class UserController {

    private final AuthService auth;
    private final UserService userService;

    public UserController(AuthService auth, UserService userService) {
        this.auth = auth;
        this.userService = userService;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current profile", description = "Loads roles, permissions and account status from the database; another user's profile cannot be requested here.")
    public ApiResponse<UserResponse> me(Authentication authentication) {
        return ApiResponse.success(auth.getCurrentUser(authentication.getName()));
    }

    @PutMapping("/me")
    @Operation(summary = "Update current profile")
    public ApiResponse<UserResponse> updateProfile(
        Authentication authentication,
        @Valid @RequestBody UpdateProfileRequest request
    ) {
        Long userId = getUserId(authentication);
        return ApiResponse.success(userService.updateProfile(userId, request));
    }

    @PutMapping("/change-password")
    @Operation(summary = "Change current password", description = "Requires the current password. Passwords and hashes are never returned.")
    public ApiResponse<Void> changePassword(
        Authentication authentication,
        @Valid @RequestBody ChangePasswordRequest request
    ) {
        Long userId = getUserId(authentication);
        userService.changePassword(userId, request);
        return ApiResponse.success(null);
    }

    private Long getUserId(Authentication authentication) {
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException ex) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
    }
}
