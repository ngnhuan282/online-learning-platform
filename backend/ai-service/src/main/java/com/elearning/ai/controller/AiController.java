package com.elearning.ai.controller;

import com.elearning.ai.common.exception.AppException;
import com.elearning.ai.common.exception.ErrorCode;
import com.elearning.ai.common.response.ApiResponse;
import com.elearning.ai.common.response.PageResponse;
import com.elearning.ai.dto.AiCapabilitiesResponse;
import com.elearning.ai.dto.ConversationResponse;
import com.elearning.ai.dto.CreateConversationRequest;
import com.elearning.ai.dto.MessageResponse;
import com.elearning.ai.dto.SendMessageRequest;
import com.elearning.ai.service.AiChatService;
import com.elearning.ai.service.AiConversationStore;
import com.elearning.ai.service.AiPreparationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import java.security.Principal;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final AiPreparationService ai;
    private final AiConversationStore store;
    private final AiChatService chat;

    public AiController(AiPreparationService ai, AiConversationStore store, AiChatService chat) {
        this.ai = ai;
        this.store = store;
        this.chat = chat;
    }

    @GetMapping("/capabilities")
    ApiResponse<AiCapabilitiesResponse> getCapabilities() {
        return ApiResponse.success(ai.getCapabilities());
    }

    @GetMapping("/conversations")
    ApiResponse<PageResponse<ConversationResponse>> getConversations(
        Principal principal,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size
    ) {
        return ApiResponse.success(store.list(userId(principal), page, size));
    }

    @PostMapping("/conversations")
    ApiResponse<ConversationResponse> createConversation(
        Principal principal,
        @RequestHeader("Authorization") String authorization,
        @Valid @RequestBody CreateConversationRequest request
    ) {
        return ApiResponse.success(chat.create(userId(principal), request, authorization));
    }

    @GetMapping("/conversations/{conversationId}")
    ApiResponse<ConversationResponse> getConversation(
        Principal principal,
        @PathVariable @Positive Long conversationId
    ) {
        return ApiResponse.success(store.owned(userId(principal), conversationId));
    }

    @GetMapping("/conversations/{conversationId}/messages")
    ApiResponse<PageResponse<MessageResponse>> getMessages(
        Principal principal,
        @PathVariable @Positive Long conversationId,
        @RequestParam(defaultValue = "0") @Min(0) int page,
        @RequestParam(defaultValue = "50") @Min(1) @Max(100) int size
    ) {
        return ApiResponse.success(store.history(userId(principal), conversationId, page, size));
    }

    @PostMapping("/conversations/{conversationId}/messages")
    ApiResponse<List<MessageResponse>> sendMessage(
        Principal principal,
        @RequestHeader("Authorization") String authorization,
        @PathVariable @Positive Long conversationId,
        @Valid @RequestBody SendMessageRequest request
    ) {
        return ApiResponse.success(chat.send(userId(principal), conversationId, request, authorization));
    }

    private Long userId(Principal principal) {
        try {
            long id = Long.parseLong(principal.getName());
            if (id <= 0) throw new NumberFormatException();
            return id;
        } catch (NumberFormatException exception) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
    }
}
