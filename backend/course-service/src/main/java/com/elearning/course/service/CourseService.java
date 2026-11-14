package com.elearning.course.service;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.CourseRequest;
import com.elearning.course.dto.CourseResponse;
import com.elearning.course.entity.Category;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseLevel;
import com.elearning.course.entity.CourseStatus;
import com.elearning.course.repository.CategoryRepository;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.security.CourseContentAccess;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.Page;
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
    private final CourseContentAccess access;

    public CourseService(CourseRepository courses, CategoryRepository categories, CourseContentAccess access) {
        this.courses = courses;
        this.categories = categories;
        this.access = access;
    }

    public Page<CourseResponse> list(int page, int size, String keyword) {
        return list(page, size, keyword, null, null, "newest");
    }

    public Page<CourseResponse> list(
        int page,
        int size,
        String keyword,
        Long categoryId,
        CourseLevel level,
        String sort
    ) {
        return list(page, size, keyword, categoryId, level, sort, null, null, null, null);
    }

    public Page<CourseResponse> list(int page, int size, String keyword, Long categoryId, CourseLevel level,
        String sort, BigDecimal minPrice, BigDecimal maxPrice, Double minRating, String pricing) {
        if ((minPrice != null && minPrice.signum() < 0) || (maxPrice != null && maxPrice.signum() < 0)
            || (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0)
            || (minRating != null && (!Double.isFinite(minRating) || minRating < 0 || minRating > 5))
            || (pricing != null && !List.of("free", "paid").contains(pricing))) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        String query = keyword == null || keyword.isBlank() ? null : keyword.strip().toLowerCase(Locale.ROOT);
        if (query != null && query.length() > 200) throw new AppException(ErrorCode.BAD_REQUEST);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100)), resolveSort(sort).and(Sort.by("id")));
        return courses.search(query, categoryId, level, minPrice, maxPrice, minRating, pricing, pageable).map(CourseResponse::from);
    }

    public Page<CourseResponse> adminList(int page, int size) {
        return courses
            .findAll(
                PageRequest.of(
                    Math.max(0, page),
                    Math.max(1, Math.min(size, 100)),
                    Sort.by(Sort.Direction.DESC, "createdAt", "id")
                )
            )
            .map(CourseResponse::from);
    }

    public CourseResponse get(Long id) {
        Course course = findCourse(id);
        access.requirePublished(course);
        return CourseResponse.from(course);
    }

    public CourseResponse adminGet(Long id) {
        return CourseResponse.from(findCourse(id));
    }

    @Transactional
    public CourseResponse create(CourseRequest request) {
        Category category = categories
            .findById(request.categoryId())
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
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
        course.setLevel(
            request.level() == null ? com.elearning.course.entity.CourseLevel.BEGINNER : request.level()
        );
        course.setStatus(request.status() == null ? CourseStatus.DRAFT : request.status());
        course.setThumbnailUrl(request.thumbnailUrl());
        return CourseResponse.from(courses.save(course));
    }

    @Transactional
    public CourseResponse update(Long id, CourseRequest request) {
        Course course = findCourse(id);
        Category category = categories
            .findById(request.categoryId())
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
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
        course.setLevel(
            request.level() == null ? com.elearning.course.entity.CourseLevel.BEGINNER : request.level()
        );
        course.setStatus(request.status() == null ? CourseStatus.DRAFT : request.status());
        course.setThumbnailUrl(request.thumbnailUrl());
        return CourseResponse.from(courses.save(course));
    }

    @Transactional
    public void delete(Long id) {
        Course course = findCourse(id);
        course.setStatus(CourseStatus.ARCHIVED);
    }

    private Sort resolveSort(String sort) {
        String normalized = sort == null ? "newest" : sort.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "oldest" -> Sort.by(Sort.Direction.ASC, "createdAt");
            case "price_asc" -> Sort.by(Sort.Direction.ASC, "price");
            case "price_desc" -> Sort.by(Sort.Direction.DESC, "price");
            case "title_asc" -> Sort.by(Sort.Direction.ASC, "title");
            case "rating_desc" -> Sort.by(Sort.Direction.DESC, "avgRating");
            case "price,asc" -> Sort.by(Sort.Direction.ASC, "price");
            case "price,desc" -> Sort.by(Sort.Direction.DESC, "price");
            case "createdat,asc" -> Sort.by(Sort.Direction.ASC, "createdAt");
            default -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
    }

    private Course findCourse(Long id) {
        return courses.findById(id).orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private String slugify(String input) {
        return input == null
            ? ""
            : input.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
    }
}
