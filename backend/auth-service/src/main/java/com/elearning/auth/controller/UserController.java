package com.elearning.auth.controller;

import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.dto.UserResponse;
import com.elearning.auth.service.AuthService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final AuthService auth;

    public UserController(AuthService auth) {
        this.auth = auth;
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me(Authentication authentication) {
        return ApiResponse.success(auth.getCurrentUser(authentication.getName()));
    }
}
