package com.elearning.course.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.dto.CategoryRequest;
import com.elearning.course.entity.Category;
import com.elearning.course.repository.CategoryRepository;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.Sort;

class CategoryServiceTests {
    final CategoryRepository repository = mock(CategoryRepository.class);
    final CategoryService service = new CategoryService(repository);

    @Test
    void createsNormalizedCategoryAndPreservesVisibilityOnPartialUpdate() {
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        var created = service.create(new CategoryRequest("  Business English  ", "  Description  ", false));
        assertThat(created.name()).isEqualTo("Business English");
        assertThat(created.slug()).isEqualTo("business-english");
        assertThat(created.description()).isEqualTo("Description");
        assertThat(created.active()).isFalse();
        var category = category(1, false);
        when(repository.findById(1L)).thenReturn(Optional.of(category));
        var updated = service.update(1L, new CategoryRequest(" Renamed ", null, null));
        assertThat(updated.slug()).isEqualTo("renamed");
        assertThat(updated.description()).isNull();
        assertThat(updated.active()).isFalse();
        assertThat(service.update(1L, new CategoryRequest("Renamed", "", true)).active()).isTrue();
    }

    @Test
    void duplicateSlugsAndMissingCategoriesAreRejectedWithoutSaving() {
        when(repository.existsBySlug("english")).thenReturn(true);
        assertThatThrownBy(() -> service.create(new CategoryRequest("English", null, null))).isInstanceOf(AppException.class);
        when(repository.findById(1L)).thenReturn(Optional.of(category(1, true)));
        assertThatThrownBy(() -> service.update(1L, new CategoryRequest("English", null, null))).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.get(999L)).isInstanceOf(AppException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void publicListExcludesArchivedCategoriesWhileAdminCanRestoreThem() {
        var active = category(1, true);
        var archived = category(2, false);
        when(repository.findAll(any(Sort.class))).thenReturn(List.of(active, archived));
        when(repository.findById(1L)).thenReturn(Optional.of(active));
        when(repository.findById(2L)).thenReturn(Optional.of(archived));
        assertThat(service.list()).extracting("id").containsExactly(1L);
        assertThat(service.adminList()).hasSize(2);
        assertThat(service.get(1L).active()).isTrue();
        assertThatThrownBy(() -> service.get(2L)).isInstanceOf(AppException.class);
        service.delete(1L);
        assertThat(active.isActive()).isFalse();
        verify(repository, never()).delete(any());
    }

    Category category(long id, boolean active) {
        var category = new Category();
        category.setId(id);
        category.setName("Category " + id);
        category.setSlug("category-" + id);
        category.setActive(active);
        return category;
    }
}
