package com.elearning.course.service;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.CourseRequest;
import com.elearning.course.dto.CourseResponse;
import com.elearning.course.entity.Category;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseStatus;
import com.elearning.course.repository.CategoryRepository;
import com.elearning.course.repository.CourseRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CourseService {

    private final CourseRepository courses;
    private final CategoryRepository categories;

    public CourseService(CourseRepository courses, CategoryRepository categories) {
        this.courses = courses;
        this.categories = categories;
    }

    public Page<CourseResponse> list(int page, int size, String keyword) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Course> result;
        if (keyword == null || keyword.isBlank()) {
            result = courses.findByStatus(CourseStatus.PUBLISHED, pageable);
            return result.map(CourseResponse::from);
        }

        List<Course> all = courses.findAll();
        List<CourseResponse> filtered = new ArrayList<>();
        String query = keyword.trim().toLowerCase();
        for (Course course : all) {
            String title = course.getTitle() == null ? "" : course.getTitle().toLowerCase();
            String description = course.getDescription() == null ? "" : course.getDescription().toLowerCase();
            if (title.contains(query) || description.contains(query)) {
                filtered.add(CourseResponse.from(course));
            }
        }

        int fromIndex = Math.min(page * size, filtered.size());
        int toIndex = Math.min(fromIndex + size, filtered.size());
        List<CourseResponse> paged = filtered.subList(fromIndex, toIndex);
        return new PageImpl<>(paged, pageable, filtered.size());
    }

    public Page<CourseResponse> adminList(int page, int size) {
        return courses.findAll(PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)),
            Sort.by(Sort.Direction.DESC, "createdAt", "id"))).map(CourseResponse::from);
    }

    public CourseResponse get(Long id) {
        return CourseResponse.from(findCourse(id));
    }

    @Transactional
    public CourseResponse create(CourseRequest request) {
        Category category = categories.findById(request.categoryId()).orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        String slug = slugify(request.title());
        if (courses.existsBySlug(slug)) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        Course course = new Course();
        course.setTitle(request.title().trim());
        course.setSlug(slug);
        course.setDescription(request.description().trim());
        course.setCategory(category);
        course.setPrice(request.price() == null ? BigDecimal.ZERO : request.price());
        course.setOriginalPrice(request.originalPrice());
        course.setLevel(request.level() == null ? com.elearning.course.entity.CourseLevel.BEGINNER : request.level());
        course.setStatus(request.status() == null ? CourseStatus.DRAFT : request.status());
        course.setThumbnailUrl(request.thumbnailUrl());
        return CourseResponse.from(courses.save(course));
    }

    @Transactional
    public CourseResponse update(Long id, CourseRequest request) {
        Course course = findCourse(id);
        Category category = categories.findById(request.categoryId()).orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        String slug = slugify(request.title());
        if (!course.getSlug().equals(slug) && courses.existsBySlug(slug)) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        course.setTitle(request.title().trim());
        course.setSlug(slug);
        course.setDescription(request.description().trim());
        course.setCategory(category);
        course.setPrice(request.price() == null ? BigDecimal.ZERO : request.price());
        course.setOriginalPrice(request.originalPrice());
        course.setLevel(request.level() == null ? com.elearning.course.entity.CourseLevel.BEGINNER : request.level());
        course.setStatus(request.status() == null ? CourseStatus.DRAFT : request.status());
        course.setThumbnailUrl(request.thumbnailUrl());
        return CourseResponse.from(courses.save(course));
    }

    @Transactional
    public void delete(Long id) {
        Course course = findCourse(id);
        courses.delete(course);
    }

    private Course findCourse(Long id) {
        return courses.findById(id).orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private String slugify(String input) {
        return input == null ? "" : input.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
    }
}
