package com.elearning.auth.controller;

import com.elearning.auth.common.exception.AppException;
import com.elearning.auth.common.exception.ErrorCode;
import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.common.response.PageResponse;
import com.elearning.auth.dto.AdminCreateUserRequest;
import com.elearning.auth.dto.AdminUpdateUserRequest;
import com.elearning.auth.dto.AdminUserResponse;
import com.elearning.auth.dto.UpdateUserRolesRequest;
import com.elearning.auth.dto.UpdateUserStatusRequest;
import com.elearning.auth.entity.enums.UserStatus;
import com.elearning.auth.security.AdminAccess;
import com.elearning.auth.service.AdminManagementService;
import com.elearning.auth.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/users")
@Tag(name = "Account administration", description = "Each operation requires its USER_* permission, checked against current database roles")
public class AdminUserController {

    private final UserService userService;

    private final AdminManagementService admin;
    private final AdminAccess access;

    public AdminUserController(UserService userService, AdminManagementService admin, AdminAccess access) {
        this.admin = admin;
        this.userService = userService;
        this.access = access;
    }

    @GetMapping
    @PreAuthorize("@adminAccess.allowed(authentication, 'USER_VIEW')")
    public ApiResponse<PageResponse<AdminUserResponse>> listUsers(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) UserStatus status,
        @RequestParam(required = false) String role
    ) {
        Page<AdminUserResponse> result = userService.listUsers(page, size, keyword, status, role);
        return ApiResponse.success(PageResponse.from(result));
    }

    @GetMapping("/{id}")
    @PreAuthorize("@adminAccess.allowed(authentication, 'USER_VIEW')")
    public ApiResponse<AdminUserResponse> getUserById(@PathVariable Long id) {
        return ApiResponse.success(userService.getUserById(id));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("@adminAccess.allowed(authentication, 'USER_STATUS_UPDATE')")
    public ApiResponse<AdminUserResponse> updateUserStatus(
        Authentication authentication,
        @PathVariable Long id,
        @Valid @RequestBody UpdateUserStatusRequest request
    ) {
        Long currentUserId = getUserId(authentication);
        return ApiResponse.success(userService.updateUserStatus(id, currentUserId, request.status()));
    }

    @PutMapping("/{id}/roles")
    @PreAuthorize("@adminAccess.allowed(authentication, 'USER_ROLES_ASSIGN')")
    public ApiResponse<AdminUserResponse> updateUserRoles(
        Authentication authentication,
        @PathVariable Long id,
        @Valid @RequestBody UpdateUserRolesRequest request
    ) {
        Long currentUserId = getUserId(authentication);
        return ApiResponse.success(userService.updateUserRoles(id, currentUserId, request.roles()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("@adminAccess.allowed(authentication, 'USER_CREATE')")
    public ApiResponse<AdminUserResponse> create(
        @Valid @RequestBody AdminCreateUserRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(
            admin.createUser(
                request,
                getUserId(auth),
                access.allowed(auth, "USER_ROLES_ASSIGN"),
                access.allowed(auth, "USER_STATUS_UPDATE")
            )
        );
    }

    @PutMapping("/{id}")
    @PreAuthorize("@adminAccess.allowed(authentication, 'USER_UPDATE')")
    public ApiResponse<AdminUserResponse> update(
        @PathVariable Long id,
        @Valid @RequestBody AdminUpdateUserRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(
            admin.updateUser(id, request, getUserId(auth), access.allowed(auth, "USER_ROLES_ASSIGN"))
        );
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@adminAccess.allowed(authentication, 'USER_DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id, Authentication auth) {
        admin.deleteUser(id, getUserId(auth));
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
