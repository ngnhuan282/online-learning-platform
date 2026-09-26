package com.elearning.auth.controller;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.dto.ChangePasswordRequest;
import com.elearning.auth.dto.UpdateProfileRequest;
import com.elearning.auth.dto.UserResponse;
import com.elearning.auth.service.AuthService;
import com.elearning.auth.service.UserService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final AuthService auth;
    private final UserService userService;

    public UserController(AuthService auth, UserService userService) {
        this.auth = auth;
        this.userService = userService;
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me(Authentication authentication) {
        return ApiResponse.success(auth.getCurrentUser(authentication.getName()));
    }

    @PutMapping("/me")
    public ApiResponse<UserResponse> updateProfile(
        Authentication authentication,
        @Valid @RequestBody UpdateProfileRequest request
    ) {
        Long userId = getUserId(authentication);
        return ApiResponse.success(userService.updateProfile(userId, request));
    }

    @PutMapping("/change-password")
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

