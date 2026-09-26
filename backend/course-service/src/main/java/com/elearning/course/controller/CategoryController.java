package com.elearning.course.controller;

import com.elearning.course.common.response.ApiResponse;
import com.elearning.course.dto.CategoryRequest;
import com.elearning.course.dto.CategoryResponse;
import com.elearning.course.service.CategoryService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class CategoryController {

    private final CategoryService categories;

    public CategoryController(CategoryService categories) {
        this.categories = categories;
    }

    @GetMapping("/categories")
    public ApiResponse<List<CategoryResponse>> list() {
        return ApiResponse.success(categories.list());
    }

    @GetMapping("/categories/{id}")
    public ApiResponse<CategoryResponse> get(@PathVariable Long id) {
        return ApiResponse.success(categories.get(id));
    }

    @PostMapping("/admin/categories")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('CATEGORY_CREATE')")
    public ApiResponse<CategoryResponse> create(@Valid @RequestBody CategoryRequest request) {
        return ApiResponse.success(categories.create(request));
    }

    @PutMapping("/admin/categories/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('CATEGORY_UPDATE')")
    public ApiResponse<CategoryResponse> update(
        @PathVariable Long id,
        @Valid @RequestBody CategoryRequest request
    ) {
        return ApiResponse.success(categories.update(id, request));
    }

    @DeleteMapping("/admin/categories/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasAuthority('CATEGORY_DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        categories.delete(id);
        return ApiResponse.success(null);
    }
}
