package com.elearning.auth.service;

import com.elearning.auth.dto.*;

public interface AuthService {
    UserResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    AuthResponse loginUser(Long userId);
    UserResponse getCurrentUser(String subject);
}
