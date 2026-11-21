package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.DictationModels.*;
import com.elearning.learning.service.*;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/dictation")
public class DictationController {

    private final DictationService dictation;
    private final DictationAudioService audio;

    public DictationController(DictationService dictation, DictationAudioService audio) {
        this.dictation = dictation;
        this.audio = audio;
    }

    @GetMapping
    public ApiResponse<Catalog> catalog(
        Principal user,
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String level,
        @RequestParam(defaultValue = "") String topic,
        @RequestParam(defaultValue = "") String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "12") int size
    ) {
        Long userId = user == null ? null : Long.parseLong(user.getName());
        return ApiResponse.success(
            dictation.catalog(userId, keyword, level, topic, page, size, false, status)
        );
    }

    @GetMapping("/topic-groups")
    public ApiResponse<GroupedCatalog> topicGroups(
        Principal user,
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String level,
        @RequestParam(defaultValue = "") String topic,
        @RequestParam(defaultValue = "") String status
    ) {
        Long userId = user == null ? null : Long.parseLong(user.getName());
        return ApiResponse.success(dictation.topicGroups(userId, keyword, level, topic, status));
    }

    @PostMapping("/exercises/{id}/attempts")
    public ApiResponse<Attempt> start(
        Principal user,
        @PathVariable String id,
        @Valid @RequestBody StartRequest request
    ) {
        return ApiResponse.success(dictation.start(Long.parseLong(user.getName()), id, request));
    }

    @GetMapping("/attempts")
    public ApiResponse<History> history(
        Principal user,
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String level,
        @RequestParam(defaultValue = "") String topic,
        @RequestParam(defaultValue = "") String status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(
            dictation.history(Long.parseLong(user.getName()), keyword, level, topic, status, page, size)
        );
    }

    @GetMapping("/attempts/{id}")
    public ApiResponse<Attempt> attempt(Principal user, @PathVariable String id) {
        return ApiResponse.success(dictation.attempt(Long.parseLong(user.getName()), id));
    }

    @PutMapping("/attempts/{id}/progress")
    public ApiResponse<Attempt> progress(
        Principal user,
        @PathVariable String id,
        @Valid @RequestBody AnswerRequest request
    ) {
        return ApiResponse.success(dictation.progress(Long.parseLong(user.getName()), id, request));
    }

    @PostMapping("/attempts/{id}/check")
    public ApiResponse<Attempt> check(
        Principal user,
        @PathVariable String id,
        @Valid @RequestBody AnswerRequest request
    ) {
        return ApiResponse.success(dictation.check(Long.parseLong(user.getName()), id, request));
    }

    @PostMapping("/attempts/{id}/hint")
    public ApiResponse<Attempt> hint(
        Principal user,
        @PathVariable String id,
        @Valid @RequestBody HintRequest request
    ) {
        return ApiResponse.success(dictation.hint(Long.parseLong(user.getName()), id, request));
    }

    @PostMapping("/attempts/{id}/reveal")
    public ApiResponse<Attempt> reveal(
        Principal user,
        @PathVariable String id,
        @Valid @RequestBody IndexRequest request
    ) {
        return ApiResponse.success(
            dictation.revealOrSkip(Long.parseLong(user.getName()), id, request.index(), true)
        );
    }

    @PostMapping("/attempts/{id}/skip")
    public ApiResponse<Attempt> skip(
        Principal user,
        @PathVariable String id,
        @Valid @RequestBody IndexRequest request
    ) {
        return ApiResponse.success(
            dictation.revealOrSkip(Long.parseLong(user.getName()), id, request.index(), false)
        );
    }

    @PostMapping("/attempts/{id}/finish")
    public ApiResponse<Attempt> finish(Principal user, @PathVariable String id) {
        return ApiResponse.success(dictation.finish(Long.parseLong(user.getName()), id));
    }

    @GetMapping("/attempts/{id}/audio")
    public ResponseEntity<Resource> audio(Principal user, @PathVariable String id) {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("audio/mpeg"))
            .cacheControl(CacheControl.noStore())
            .body(audio.resource(dictation.audioKey(Long.parseLong(user.getName()), id)));
    }
}
