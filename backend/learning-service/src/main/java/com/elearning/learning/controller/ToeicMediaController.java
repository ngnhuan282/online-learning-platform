package com.elearning.learning.controller;

import static com.elearning.learning.service.ToeicMediaService.MEDIA_PATH;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.service.ToeicMediaService;
import com.elearning.learning.service.ToeicMediaService.Kind;
import com.elearning.learning.service.ToeicMediaService.Library;
import com.elearning.learning.service.ToeicMediaService.Media;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class ToeicMediaController {

    private static final String ADMIN_MEDIA = "/api/v1/learning/admin/toeic/media";
    private final ToeicMediaService media;

    public ToeicMediaController(ToeicMediaService media) {
        this.media = media;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping(ADMIN_MEDIA)
    public ApiResponse<Library> list(
        @RequestParam(required = false) Kind kind,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(media.list(kind, page, size));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(path = ADMIN_MEDIA, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Media> create(
        @RequestParam MultipartFile file,
        @RequestParam(required = false) Kind kind
    ) {
        return ApiResponse.success(media.create(file, kind));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping(path = ADMIN_MEDIA + "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Media> replace(
        @PathVariable UUID id,
        @RequestParam long version,
        @RequestParam MultipartFile file
    ) {
        return ApiResponse.success(media.replace(id, version, file));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping(ADMIN_MEDIA + "/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @RequestParam long version) {
        media.delete(id, version);
    }

    @RequestMapping(path = MEDIA_PATH + "{id}", method = { RequestMethod.GET, RequestMethod.HEAD })
    public ResponseEntity<Resource> read(@PathVariable UUID id, HttpServletRequest request) {
        boolean headOnly = request.getMethod().equals("HEAD");
        var delivery = media.delivery(id, headOnly);
        if (delivery.redirect() != null) {
            return ResponseEntity.status(HttpStatus.TEMPORARY_REDIRECT)
                .cacheControl(CacheControl.noStore())
                .location(delivery.redirect())
                .build();
        }
        var response = ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .contentType(MediaType.parseMediaType(delivery.contentType()));
        return headOnly ? response.contentLength(delivery.size()).build() : response.body(delivery.file());
    }
}
