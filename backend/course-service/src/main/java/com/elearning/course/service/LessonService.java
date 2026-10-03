package com.elearning.course.service;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.LessonRequest;
import com.elearning.course.dto.LessonResponse;
import com.elearning.course.dto.ReorderRequest;
import com.elearning.course.entity.Lesson;
import com.elearning.course.entity.LessonType;
import com.elearning.course.entity.Section;
import com.elearning.course.repository.LessonRepository;
import com.elearning.course.repository.SectionRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class LessonService {

    private final LessonRepository lessons;
    private final SectionRepository sections;

    public LessonService(LessonRepository lessons, SectionRepository sections) {
        this.lessons = lessons;
        this.sections = sections;
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
}
