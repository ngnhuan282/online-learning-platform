package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.ToeicModels.*;
import com.elearning.learning.service.ToeicService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/admin/toeic/exams")
@PreAuthorize("hasRole('ADMIN')")
public class AdminToeicController {

    private final ToeicService toeic;

    public AdminToeicController(ToeicService toeic) {
        this.toeic = toeic;
    }

    @GetMapping
    public ApiResponse<List<Summary>> list() {
        return ApiResponse.success(toeic.listAdmin());
    }

    @GetMapping("/{examId}")
    public ApiResponse<AdminDetail> detail(@PathVariable long examId) {
        return ApiResponse.success(toeic.adminDetail(examId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AdminDetail> create(@RequestBody Definition body) {
        return ApiResponse.success(toeic.create(body));
    }

    @PutMapping("/{examId}")
    public ApiResponse<AdminDetail> update(@PathVariable long examId, @RequestBody Definition body) {
        return ApiResponse.success(toeic.update(examId, body));
    }

    @PatchMapping("/{examId}/publish")
    public ApiResponse<AdminDetail> publish(@PathVariable long examId, @RequestBody PublishRequest body) {
        return ApiResponse.success(toeic.publish(examId, body));
    }

    @DeleteMapping("/{examId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long examId) {
        toeic.delete(examId);
    }
}
