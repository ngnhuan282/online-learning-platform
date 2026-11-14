package com.elearning.course.security;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseStatus;
import com.elearning.course.entity.Lesson;
import com.elearning.course.integration.learning.LearningAccessClient;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
public class CourseContentAccess {

    private final LearningAccessClient learning;

    public CourseContentAccess(LearningAccessClient learning) {
        this.learning = learning;
    }

    public boolean isEditor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(authority ->
                java.util.Set.of("ROLE_ADMIN", "COURSE_UPDATE").contains(authority.getAuthority()));
    }

    public void requirePublished(Course course) {
        if (isEditor() || course.getStatus() == CourseStatus.PUBLISHED) return;
        // Archiving stops discovery/new purchases, without revoking purchased access.
        if (course.getStatus() == CourseStatus.ARCHIVED && hasEnrollment(course)) return;
        throw new AppException(ErrorCode.NOT_FOUND);
    }

    public boolean canReadPrivate(Course course) {
        if (isEditor()) return true;
        requirePublished(course);
        return hasEnrollment(course);
    }

    private boolean hasEnrollment(Course course) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) return false;
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) return false;
        String authorization = attributes.getRequest().getHeader("Authorization");
        return authorization != null && learning.isEnrolled(course.getId(), authorization);
    }

    public void requireLesson(Lesson lesson) {
        Course course = lesson.getSection().getCourse();
        requirePublished(course);
        if (!isEditor() && !lesson.isPreview() && !canReadPrivate(course)) {
            throw new AppException(ErrorCode.FORBIDDEN, "Enrollment is required to access this lesson");
        }
    }
}
