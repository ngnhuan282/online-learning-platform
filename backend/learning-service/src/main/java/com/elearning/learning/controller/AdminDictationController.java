package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.DictationModels.*;
import com.elearning.learning.service.*;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/learning/admin/dictation")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDictationController {

    private final DictationService service;
    private final DictationAudioService audio;
    private final DictationWorkbookService workbooks;
    private final DictationAdminPublication publication;

    public AdminDictationController(
        DictationService service,   
        DictationAudioService audio,
        DictationWorkbookService workbooks,
        DictationAdminPublication publication
    ) {
        this.service = service;
        this.audio = audio;
        this.workbooks = workbooks;
        this.publication = publication;
    }

    @GetMapping
    public ApiResponse<Catalog> list(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String level,
        @RequestParam(defaultValue = "") String topic,
        @RequestParam(defaultValue = "") String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "12") int size
    ) {
        return ApiResponse.success(service.catalog(null, keyword, level, topic, page, size, true, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminDetail> detail(@PathVariable String id) {
        return ApiResponse.success(service.adminDetail(id));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AdminDetail>> create(@Valid @RequestBody SaveRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            ApiResponse.success(service.save(null, request))
        );
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminDetail> update(@PathVariable String id, @Valid @RequestBody SaveRequest request) {
        return ApiResponse.success(service.save(id, request));
    }

    @PostMapping("/publish")
    public ResponseEntity<ApiResponse<AdminDetail>> createAndPublish(
        @Valid @RequestBody SaveRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
            ApiResponse.success(publication.publish(null, new PublishRequest(request.version(), request.definition())))
        );
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<AdminDetail> publish(
        @PathVariable String id,
        @Valid @RequestBody PublishRequest request
    ) {
        return ApiResponse.success(publication.publish(id, request));
    }

    @PutMapping("/{id}/visibility")
    public ApiResponse<AdminDetail> visibility(
        @PathVariable String id,
        @RequestBody VisibilityRequest request
    ) {
        return ApiResponse.success(publication.visibility(id, request.archived()));
    }

    @PostMapping(value = "/audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Audio> upload(@RequestPart("file") MultipartFile file) {
        return ApiResponse.success(audio.upload(file));
    }

    @GetMapping("/audio/{key}")
    public ResponseEntity<Resource> audio(@PathVariable String key) {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("audio/mpeg"))
            .cacheControl(CacheControl.noStore())
            .body(audio.resource(key));
    }

    @GetMapping("/template")
    public ResponseEntity<byte[]> template() {
        return workbookResponse("transcript-template.xlsx", workbooks.template());
    }

    @GetMapping("/{id}/workbook")
    public ResponseEntity<byte[]> workbook(@PathVariable String id) {
        return workbookResponse("dictation-" + id + ".xlsx", publication.download(id));
    }

    private ResponseEntity<byte[]> workbookResponse(String filename, byte[] body) {
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
            .cacheControl(CacheControl.noStore())
            .contentType(
                MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            )
            .body(body);
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ImportResult> parse(@RequestPart("file") MultipartFile file) {
        return ApiResponse.success(workbooks.parse(file));
    }
}
