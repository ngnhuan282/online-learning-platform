package com.elearning.ai.dto;

import com.elearning.ai.service.AiPreparationService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
    @NotBlank @Size(max = AiPreparationService.MAX_MESSAGE_LENGTH) String content
) {}
