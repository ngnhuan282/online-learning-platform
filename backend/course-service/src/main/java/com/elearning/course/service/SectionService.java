package com.elearning.course.service;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.ReorderRequest;
import com.elearning.course.dto.SectionRequest;
import com.elearning.course.dto.SectionResponse;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.Section;
import com.elearning.course.repository.CourseRepository;
import com.elearning.course.repository.SectionRepository;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SectionService {

    private final SectionRepository sections;
    private final CourseRepository courses;

    public SectionService(SectionRepository sections, CourseRepository courses) {
        this.sections = sections;
        this.courses = courses;
    }

    public List<SectionResponse> listByCourse(Long courseId) {
        findCourse(courseId);
        return sections.findByCourseIdOrderByOrderIndexAsc(courseId).stream()
            .map(SectionResponse::from)
            .toList();
    }

    @Transactional
    public SectionResponse create(Long courseId, SectionRequest request) {
        Course course = findCourse(courseId);
        Section section = new Section();
        section.setCourse(course);
        section.setTitle(request.title().trim());
        section.setOrderIndex(request.orderIndex());
        return SectionResponse.from(sections.save(section));
    }

    @Transactional
    public SectionResponse update(Long courseId, Long sectionId, SectionRequest request) {
        Section section = findSection(courseId, sectionId);
        section.setTitle(request.title().trim());
        section.setOrderIndex(request.orderIndex());
        return SectionResponse.from(sections.save(section));
    }

    @Transactional
    public void delete(Long courseId, Long sectionId) {
        Section section = findSection(courseId, sectionId);
        sections.delete(section);
    }

    @Transactional
    public void reorder(Long courseId, ReorderRequest request) {
        findCourse(courseId);
        List<Section> all = sections.findByCourseIdOrderByOrderIndexAsc(courseId);
        Map<Long, Section> byId = all.stream().collect(Collectors.toMap(Section::getId, s -> s));

        for (ReorderRequest.Item item : request.items()) {
            Section section = byId.get(item.id());
            if (section == null) {
                throw new AppException(ErrorCode.NOT_FOUND);
            }
            section.setOrderIndex(item.orderIndex());
        }
        sections.saveAll(all);
    }

    private Course findCourse(Long courseId) {
        return courses.findById(courseId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private Section findSection(Long courseId, Long sectionId) {
        Section section = sections.findById(sectionId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (!section.getCourse().getId().equals(courseId)) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        return section;
    }
}
