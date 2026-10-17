package com.elearning.ai.controller;

import com.elearning.ai.common.response.ApiResponse;
import com.elearning.ai.dto.AiCapabilitiesResponse;
import com.elearning.ai.dto.CreateConversationRequest;
import com.elearning.ai.dto.SendMessageRequest;
import com.elearning.ai.service.AiPreparationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final AiPreparationService ai;

    public AiController(AiPreparationService ai) {
        this.ai = ai;
    }

    @GetMapping("/capabilities")
    ApiResponse<AiCapabilitiesResponse> getCapabilities() {
        return ApiResponse.success(ai.getCapabilities());
    }

    @GetMapping("/conversations")
    ApiResponse<Void> getConversations(
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        ai.requireAvailable();
        return ApiResponse.success(null);
    }

    @PostMapping("/conversations")
    ApiResponse<Void> createConversation(@Valid @RequestBody CreateConversationRequest request) {
        ai.requireAvailable();
        return ApiResponse.success(null);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    ApiResponse<Void> getMessages(@PathVariable @Positive Long conversationId) {
        ai.requireAvailable();
        return ApiResponse.success(null);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    ApiResponse<Void> sendMessage(
        @PathVariable @Positive Long conversationId,
        @Valid @RequestBody SendMessageRequest request
    ) {
        ai.requireAvailable();
        return ApiResponse.success(null);
    }
}
