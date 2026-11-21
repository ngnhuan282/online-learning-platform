package com.elearning.course;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.SectionResponse;
import com.elearning.course.entity.Course;
import com.elearning.course.entity.CourseStatus;
import com.elearning.course.entity.Lesson;
import com.elearning.course.entity.Section;
import com.elearning.course.integration.learning.LearningAccessClient;
import com.elearning.course.security.CourseContentAccess;
import com.elearning.course.security.MediaTickets;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class CourseContentAccessTests {

    final LearningAccessClient learning = mock(LearningAccessClient.class);
    final CourseContentAccess access = new CourseContentAccess(learning);
    final MediaTickets tickets = new MediaTickets("test-secret-with-at-least-32-characters");

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    Course course() {
        Course course = new Course();
        course.setId(42L);
        course.setStatus(CourseStatus.PUBLISHED);
        return course;
    }

    Lesson lesson(Course course, boolean preview) {
        Section section = new Section();
        section.setCourse(course);
        Lesson lesson = new Lesson();
        lesson.setSection(section);
        lesson.setPreview(preview);
        lesson.setContent("private-content");
        lesson.setVideoUrl("/api/v1/media/download/videos/test.mp4");
        section.setLessons(List.of(lesson));
        return lesson;
    }

    void authenticate(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "7", null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer validated-user-jwt");
        request.addHeader("X-User-Id", "999");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @Test
    void loadContent_whenCallerIsGuest_shouldReturnMetadataAndPreviewWithoutPrivateContent() {
        // Arrange
        Course course = course();
        Lesson privateLesson = lesson(course, false);
        // Act
        assertThat(access.canReadPrivate(course)).isFalse();
        SectionResponse response = SectionResponse.forReader(privateLesson.getSection(), false, tickets);
        assertThat(response.lessons().getFirst().content()).isNull();
        assertThat(response.lessons().getFirst().videoUrl()).isNull();
        assertThatThrownBy(() -> access.requireLesson(privateLesson)).isInstanceOf(AppException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);

        Lesson preview = lesson(course, true);
        access.requireLesson(preview);
        // Assert
        assertThat(SectionResponse.forReader(preview.getSection(), false, tickets).lessons().getFirst().content())
                .isEqualTo("private-content");
        verifyNoInteractions(learning);
    }

    @Test
    void authorizeLesson_whenUserRequestsPrivateLesson_shouldRequireEnrollmentAndForwardJwt() {
        // Arrange
        // Act
        authenticate("USER");
        Course course = course();
        when(learning.isEnrolled(42L, "Bearer validated-user-jwt")).thenReturn(false, true);
        Lesson lesson = lesson(course, false);
        assertThatThrownBy(() -> access.requireLesson(lesson)).hasFieldOrPropertyWithValue("errorCode", ErrorCode.FORBIDDEN);
        access.requireLesson(lesson);
        // Assert
        verify(learning, times(2)).isEnrolled(42L, "Bearer validated-user-jwt");
    }

    @Test
    void authorizeLesson_whenCourseIsDraftOrLearningUnavailable_shouldDenyPrivateAccess() {
        // Arrange
        Course course = course();
        course.setStatus(CourseStatus.DRAFT);
        // Act
        assertThatThrownBy(() -> access.requirePublished(course)).hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        authenticate("USER");
        course.setStatus(CourseStatus.PUBLISHED);
        when(learning.isEnrolled(42L, "Bearer validated-user-jwt")).thenThrow(new AppException(ErrorCode.SERVICE_UNAVAILABLE));
        // Assert
        assertThatThrownBy(() -> access.requireLesson(lesson(course, false)))
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.SERVICE_UNAVAILABLE);
    }

    @Test
    void authorizeLesson_whenAdminEditsDraft_shouldSkipEnrollmentCheck() {
        // Arrange
        // Act
        authenticate("ADMIN");
        Course course = course();
        course.setStatus(CourseStatus.DRAFT);
        access.requireLesson(lesson(course, false));
        // Assert
        assertThat(access.canReadPrivate(course)).isTrue();
        verifyNoInteractions(learning);
    }

    @Test
    void authorizeLesson_whenCourseIsArchived_shouldAllowOnlyPreviouslyPurchasedAccess() {
        // Arrange
        Course course = course();
        course.setStatus(CourseStatus.ARCHIVED);
        // Act
        assertThatThrownBy(() -> access.requirePublished(course)).hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        authenticate("USER");
        when(learning.isEnrolled(42L, "Bearer validated-user-jwt")).thenReturn(false);
        assertThatThrownBy(() -> access.requirePublished(course)).hasFieldOrPropertyWithValue("errorCode", ErrorCode.NOT_FOUND);
        when(learning.isEnrolled(42L, "Bearer validated-user-jwt")).thenReturn(true);
        access.requireLesson(lesson(course, false));
        // Assert
        assertThat(access.canReadPrivate(course)).isTrue();
    }

    @Test
    void validateTicket_whenObjectDoesNotMatchOrTicketIsInvalid_shouldRejectDownload() {
        // Arrange
        String url = tickets.signLocalUrl("/api/v1/media/download/videos/test.mp4");
        // Act
        var parts = url.split("[?&=]");

        // Assert
        assertThat(tickets.valid("videos/test.mp4", parts[2], parts[4])).isTrue();
        assertThat(tickets.valid("videos/other.mp4", parts[2], parts[4])).isFalse();
        assertThat(tickets.valid("videos/test.mp4", "1", parts[4])).isFalse();
        assertThat(tickets.valid("videos/test.mp4", parts[2], "tampered")).isFalse();
        assertThat(tickets.valid("videos/test.mp4", "invalid", parts[4])).isFalse();
    }
}
