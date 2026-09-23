package com.elearning.auth.controller;

import com.elearning.auth.common.response.ApiResponse;
import com.elearning.auth.dto.SaveRoleRequest;
import com.elearning.auth.security.AdminPermission;
import com.elearning.auth.service.AdminManagementService;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminManagementController {
    private final AdminManagementService service;
    public AdminManagementController(AdminManagementService service) { this.service = service; }

    @GetMapping("/roles")
    @PreAuthorize("@adminAccess.allowed(authentication, 'ROLE_VIEW') or @adminAccess.allowed(authentication, 'USER_VIEW')")
    public ApiResponse<?> roles() { return ApiResponse.success(service.roles()); }

    @GetMapping("/permissions")
    @PreAuthorize("@adminAccess.allowed(authentication, 'ROLE_VIEW')")
    public ApiResponse<?> permissions() {
        return ApiResponse.success(Arrays.stream(AdminPermission.values()).map(p -> Map.of(
            "code", p.name(), "group", p.group, "resource", p.resource, "action", p.action,
            "label", p.label, "adminOnly", p.adminOnly, "dependencies", p.dependencies())).toList());
    }

    @PostMapping("/roles")
    @PreAuthorize("@adminAccess.allowed(authentication, 'ROLE_MANAGE')")
    public ApiResponse<?> create(@Valid @RequestBody SaveRoleRequest request, Authentication auth) {
        return ApiResponse.success(service.saveRole(null, request, Long.valueOf(auth.getName())));
    }

    @PutMapping("/roles/{id}")
    @PreAuthorize("@adminAccess.allowed(authentication, 'ROLE_MANAGE')")
    public ApiResponse<?> update(@PathVariable Long id, @Valid @RequestBody SaveRoleRequest request, Authentication auth) {
        return ApiResponse.success(service.saveRole(id, request, Long.valueOf(auth.getName())));
    }

    @DeleteMapping("/roles/{id}")
    @PreAuthorize("@adminAccess.allowed(authentication, 'ROLE_MANAGE')")
    public ApiResponse<?> delete(@PathVariable Long id, Authentication auth) {
        service.deleteRole(id, Long.valueOf(auth.getName()));
        return ApiResponse.success(null);
    }

    @GetMapping("/overview")
    @PreAuthorize("@adminAccess.allowed(authentication, 'DASHBOARD_VIEW') or @adminAccess.allowed(authentication, 'USER_VIEW')")
    public ApiResponse<?> overview() { return ApiResponse.success(service.overview()); }

    @GetMapping("/audit")
    @PreAuthorize("@adminAccess.allowed(authentication, 'AUDIT_VIEW')")
    public ApiResponse<?> audit() { return ApiResponse.success(service.audit()); }
}
