package com.elearning.course.service;

import com.elearning.course.common.exception.AppException;
import com.elearning.course.common.exception.ErrorCode;
import com.elearning.course.dto.LessonResourceRequest;
import com.elearning.course.dto.LessonResourceResponse;
import com.elearning.course.entity.Lesson;
import com.elearning.course.entity.LessonResource;
import com.elearning.course.integration.storage.StorageService;
import com.elearning.course.repository.LessonRepository;
import com.elearning.course.repository.LessonResourceRepository;
import com.elearning.course.security.CourseContentAccess;
import com.elearning.course.security.MediaTickets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LessonResourceService {

    private final LessonResourceRepository resourceRepository;
    private final LessonRepository lessonRepository;
    private final StorageService storageService;
    private final CourseContentAccess access;
    private final MediaTickets tickets;

    @Transactional(readOnly = true)
    public List<LessonResourceResponse> getResourcesByLesson(Long lessonId) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        access.requireLesson(lesson);
        return resourceRepository.findByLessonIdOrderByCreatedAtAsc(lessonId).stream()
                .map(resource -> new LessonResourceResponse(
                    resource.getId(), lessonId, resource.getResourceType(), resource.getTitle(),
                    resource.getFileName(), resource.getFileSize(), resource.getContentType(), resource.getObjectKey(),
                    tickets.signLocalUrl(storageService.getDownloadUrl(resource.getObjectKey())), resource.getCreatedAt()
                ))
                .toList();
    }

    @Transactional
    public LessonResourceResponse addResource(Long lessonId, LessonResourceRequest request) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy bài học id=" + lessonId));

        LessonResource resource = new LessonResource();
        resource.setLesson(lesson);
        resource.setResourceType(request.resourceType());
        resource.setTitle(request.title().trim());
        resource.setFileName(request.fileName().trim());
        resource.setFileSize(request.fileSize());
        resource.setContentType(request.contentType());
        resource.setObjectKey(request.objectKey().trim());

        resource.setDownloadUrl("/api/v1/media/download/" + request.objectKey().trim());

        LessonResource saved = resourceRepository.save(resource);
        return LessonResourceResponse.from(saved);
    }

    @Transactional
    public void deleteResource(Long resourceId) {
        LessonResource resource = resourceRepository.findById(resourceId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND, "Không tìm thấy tài nguyên id=" + resourceId));

        // Xóa file thực tế trên storage
        storageService.delete(resource.getObjectKey());

        resourceRepository.delete(resource);
    }
}
