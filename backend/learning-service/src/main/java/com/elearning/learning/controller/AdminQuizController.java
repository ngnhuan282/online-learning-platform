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
@PreAuthorize("@learningAdmin.allowed(authentication,'QUIZ_VIEW')")
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
    @PreAuthorize("@learningAdmin.allowed(authentication,'QUIZ_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AdminQuizResponse> create(@Valid @RequestBody QuizDefinitionRequest request) {
        return ApiResponse.success(quizzes.create(request));
    }

    @PutMapping("/{quizId}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'QUIZ_MANAGE')")
    public ApiResponse<AdminQuizResponse> update(
        @PathVariable Long quizId,
        @Valid @RequestBody QuizDefinitionRequest request
    ) {
        return ApiResponse.success(quizzes.update(quizId, request));
    }

    @PatchMapping("/{quizId}/publish")
    @PreAuthorize("@learningAdmin.allowed(authentication,'QUIZ_MANAGE')")
    public ApiResponse<AdminQuizResponse> publish(@PathVariable Long quizId) {
        return ApiResponse.success(quizzes.publish(quizId));
    }

    @DeleteMapping("/{quizId}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'QUIZ_MANAGE')")
    public ApiResponse<Void> deleteDraft(@PathVariable Long quizId) {
        quizzes.deleteDraft(quizId);
        return ApiResponse.success(null);
    }
}
