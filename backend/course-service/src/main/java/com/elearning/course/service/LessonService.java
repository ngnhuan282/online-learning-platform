package com.elearning.course.service;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.LessonPlayResponse;
import com.elearning.course.dto.LessonRequest;
import com.elearning.course.dto.LessonResponse;
import com.elearning.course.dto.ReorderRequest;
import com.elearning.course.entity.Lesson;
import com.elearning.course.entity.LessonType;
import com.elearning.course.entity.Section;
import com.elearning.course.integration.learning.EnrollmentClient;
import com.elearning.course.integration.storage.StorageService;
import com.elearning.course.repository.LessonRepository;
import com.elearning.course.repository.SectionRepository;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LessonService {

    private static final Logger log = LoggerFactory.getLogger(LessonService.class);

    private final LessonRepository lessons;
    private final SectionRepository sections;
    private final StorageService storageService;
    private final EnrollmentClient enrollmentClient;

    public LessonService(
        LessonRepository lessons,
        SectionRepository sections,
        StorageService storageService,
        EnrollmentClient enrollmentClient
    ) {
        this.lessons = lessons;
        this.sections = sections;
        this.storageService = storageService;
        this.enrollmentClient = enrollmentClient;
    }

    @Transactional
    public LessonResponse create(Long sectionId, LessonRequest request) {
        Section section = findSection(sectionId);
        validateLessonRequest(request);

        Lesson lesson = new Lesson();
        lesson.setSection(section);
        applyRequest(lesson, request);
        return LessonResponse.from(lessons.save(lesson));
    }

    @Transactional
    public LessonResponse update(Long lessonId, LessonRequest request) {
        Lesson lesson = findLesson(lessonId);
        validateLessonRequest(request);
        applyRequest(lesson, request);
        return LessonResponse.from(lessons.save(lesson));
    }

    @Transactional
    public void delete(Long lessonId) {
        Lesson lesson = findLesson(lessonId);
        lessons.delete(lesson);
    }

    @Transactional
    public void reorder(Long sectionId, ReorderRequest request) {
        findSection(sectionId);
        if (request != null && request.items() != null) {
            java.util.Set<Integer> seen = new java.util.HashSet<>();
            for (ReorderRequest.Item item : request.items()) {
                if (!seen.add(item.orderIndex())) {
                    throw new AppException(ErrorCode.BAD_REQUEST, "Thứ tự bài học không được trùng lặp");
                }
            }
        }
        List<Lesson> all = lessons.findBySectionIdOrderByOrderIndexAsc(sectionId);
        Map<Long, Lesson> byId = all.stream().collect(Collectors.toMap(Lesson::getId, l -> l));

        for (ReorderRequest.Item item : request.items()) {
            Lesson lesson = byId.get(item.id());
            if (lesson == null) {
                throw new AppException(ErrorCode.NOT_FOUND);
            }
            lesson.setOrderIndex(item.orderIndex());
        }
        lessons.saveAll(all);
    }

    private void applyRequest(Lesson lesson, LessonRequest request) {
        lesson.setTitle(request.title().trim());
        lesson.setLessonType(request.lessonType());
        lesson.setContent(request.content());
        lesson.setVideoUrl(request.videoUrl());
        lesson.setDuration(request.duration());
        lesson.setOrderIndex(request.orderIndex());
        lesson.setPreview(request.preview());
    }

    /**
     * VIDEO type phải có videoUrl (có thể là placeholder trong T4, đầy đủ sau khi upload S3 ở T5).
     */
    private void validateLessonRequest(LessonRequest request) {
        if (request.lessonType() == LessonType.VIDEO
                && (request.videoUrl() == null || request.videoUrl().isBlank())) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
    }

    private Section findSection(Long sectionId) {
        return sections.findById(sectionId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private Lesson findLesson(Long lessonId) {
        return lessons.findById(lessonId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    /**
     * Cấp play URL cho bài học.
     * - Nếu bài preview: cho phép xem tự do (cả Guest).
     * - Nếu bài private: yêu cầu đăng nhập, kiểm tra admin hoặc đã enroll khóa học.
     */
    public LessonPlayResponse getPlayUrl(Long courseId, Long lessonId, Long currentUserId, boolean isAdmin) {
        Lesson lesson = findLesson(lessonId);
        Section section = lesson.getSection();
        if (section == null || section.getCourse() == null || !section.getCourse().getId().equals(courseId)) {
            throw new AppException(ErrorCode.NOT_FOUND, "Bài học không thuộc khóa học này");
        }

        // 1. Bài học preview: cho phép xem tự do
        if (lesson.isPreview()) {
            String playUrl = resolvePlayUrl(lesson);
            return new LessonPlayResponse(
                lesson.getId(),
                lesson.getTitle(),
                lesson.getLessonType(),
                playUrl,
                1800,
                true,
                lesson.getContent(),
                lesson.getDuration()
            );
        }

        // 2. Bài học riêng tư: yêu cầu đăng nhập
        if (currentUserId == null) {
            log.warn("Unauthorized access attempt: userId=anonymous, lessonId={}, reason=NOT_LOGGED_IN", lessonId);
            throw new AppException(ErrorCode.UNAUTHORIZED, "Vui lòng đăng nhập để xem bài học này");
        }

        // 3. Kiểm tra quyền truy cập (Admin hoặc Học viên đã đăng ký)
        boolean hasAccess = isAdmin;
        if (!hasAccess) {
            hasAccess = enrollmentClient.isEnrolled(currentUserId, courseId);
        }

        if (!hasAccess) {
            log.warn("Unauthorized access attempt: userId={}, lessonId={}, reason=NOT_ENROLLED", currentUserId, lessonId);
            throw new AppException(ErrorCode.FORBIDDEN, "Bạn cần đăng ký khóa học này để xem nội dung bài học");
        }

        String playUrl = resolvePlayUrl(lesson);
        return new LessonPlayResponse(
            lesson.getId(),
            lesson.getTitle(),
            lesson.getLessonType(),
            playUrl,
            1800,
            false,
            lesson.getContent(),
            lesson.getDuration()
        );
    }

    private String resolvePlayUrl(Lesson lesson) {
        if (lesson.getLessonType() == LessonType.VIDEO) {
            String videoUrl = lesson.getVideoUrl();
            if (videoUrl == null || videoUrl.isBlank()) {
                return "https://vjs.zencdn.net/v/oceans.mp4";
            }
            if (videoUrl.contains("/api/v1/media/download/")) {
                String objectKey = videoUrl.substring(videoUrl.indexOf("/api/v1/media/download/") + "/api/v1/media/download/".length());
                if (objectKey.contains("?")) {
                    objectKey = objectKey.substring(0, objectKey.indexOf("?"));
                }
                return storageService.generatePresignedUrl(objectKey, Duration.ofMinutes(30));
            } else if (videoUrl.startsWith("/storage/local/") || videoUrl.contains("mock") || videoUrl.contains("commondatastorage.googleapis.com")) {
                // Mock seed path or broken CDN link -> fallback to reliable Video.js public sample
                return "https://vjs.zencdn.net/v/oceans.mp4";
            } else if (!videoUrl.startsWith("http://") && !videoUrl.startsWith("https://")) {
                return storageService.generatePresignedUrl(videoUrl, Duration.ofMinutes(30));
            }
            return videoUrl;
        }
        return lesson.getVideoUrl();
    }
}
