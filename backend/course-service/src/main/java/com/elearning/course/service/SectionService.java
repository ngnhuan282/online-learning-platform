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
import com.elearning.course.security.CourseContentAccess;
import com.elearning.course.security.MediaTickets;
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
    private final CourseContentAccess access;
    private final MediaTickets tickets;

    public SectionService(SectionRepository sections, CourseRepository courses, CourseContentAccess access, MediaTickets tickets) {
        this.sections = sections;
        this.courses = courses;
        this.access = access;
        this.tickets = tickets;
    }

    public List<SectionResponse> listByCourse(Long courseId) {
        Course course = findCourse(courseId);
        access.requirePublished(course);
        boolean enrolled = access.canReadPrivate(course);
        return sections.findByCourseIdWithLessons(courseId).stream()
            .map(section -> SectionResponse.forReader(section, enrolled, tickets))
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
        if (request != null && request.items() != null) {
            java.util.Set<Integer> seen = new java.util.HashSet<>();
            for (ReorderRequest.Item item : request.items()) {
                if (!seen.add(item.orderIndex())) {
                    throw new AppException(ErrorCode.BAD_REQUEST, "Thứ tự chương học không được trùng lặp");
                }
            }
        }
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
