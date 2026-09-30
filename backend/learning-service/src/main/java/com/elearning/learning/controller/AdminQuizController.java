package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.AdminQuizResponse;
import com.elearning.learning.dto.QuizDefinitionRequest;
import com.elearning.learning.service.QuizService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/admin/quizzes")
@PreAuthorize("hasRole('ADMIN')")
public class AdminQuizController {

    private final QuizService quizzes;

    public AdminQuizController(QuizService quizzes) {
        this.quizzes = quizzes;
    }

    @GetMapping
    public ApiResponse<?> list() {
        return ApiResponse.success(quizzes.listAdmin());
    }

    @GetMapping("/{quizId}")
    public ApiResponse<AdminQuizResponse> get(@PathVariable Long quizId) {
        return ApiResponse.success(quizzes.getAdmin(quizId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AdminQuizResponse> create(@Valid @RequestBody QuizDefinitionRequest request) {
        return ApiResponse.success(quizzes.create(request));
    }

    @PutMapping("/{quizId}")
    public ApiResponse<AdminQuizResponse> update(
        @PathVariable Long quizId,
        @Valid @RequestBody QuizDefinitionRequest request
    ) {
        return ApiResponse.success(quizzes.update(quizId, request));
    }

    @PatchMapping("/{quizId}/publish")
    public ApiResponse<AdminQuizResponse> publish(@PathVariable Long quizId) {
        return ApiResponse.success(quizzes.publish(quizId));
    }

    @DeleteMapping("/{quizId}")
    public ApiResponse<Void> deleteDraft(@PathVariable Long quizId) {
        quizzes.deleteDraft(quizId);
        return ApiResponse.success(null);
    }
}
