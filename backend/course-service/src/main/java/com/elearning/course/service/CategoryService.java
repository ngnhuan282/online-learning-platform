package com.elearning.course.service;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.CategoryRequest;
import com.elearning.course.dto.CategoryResponse;
import com.elearning.course.entity.Category;
import com.elearning.course.repository.CategoryRepository;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CategoryService {

    private final CategoryRepository categories;

    public CategoryService(CategoryRepository categories) {
        this.categories = categories;
    }

    public List<CategoryResponse> list() {
        return categories.findAll(Sort.by(Sort.Direction.ASC, "name")).stream().map(CategoryResponse::from).toList();
    }

    public CategoryResponse get(Long id) {
        return CategoryResponse.from(findCategory(id));
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        String normalized = request.name().trim();
        String slug = slugify(normalized);
        if (categories.existsBySlug(slug)) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        Category category = new Category();
        category.setName(normalized);
        category.setSlug(slug);
        category.setDescription(request.description() == null ? null : request.description().trim());
        return CategoryResponse.from(categories.save(category));
    }

    @Transactional
    public CategoryResponse update(Long id, CategoryRequest request) {
        Category category = findCategory(id);
        String normalized = request.name().trim();
        String slug = slugify(normalized);
        if (!category.getSlug().equals(slug) && categories.existsBySlug(slug)) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        category.setName(normalized);
        category.setSlug(slug);
        category.setDescription(request.description() == null ? null : request.description().trim());
        return CategoryResponse.from(categories.save(category));
    }

    @Transactional
    public void delete(Long id) {
        Category category = findCategory(id);
        categories.delete(category);
    }

    private Category findCategory(Long id) {
        return categories.findById(id).orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private String slugify(String input) {
        return input == null ? "" : input.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
    }
}
