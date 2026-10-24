package com.elearning.ai.dto;

import com.elearning.ai.service.AiPreparationService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
    @NotBlank @Size(max = AiPreparationService.MAX_MESSAGE_LENGTH) String content,
    @Pattern(regexp = "[a-zA-Z0-9_-]{8,64}") String requestId
) {}
