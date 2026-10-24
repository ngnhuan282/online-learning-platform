package com.elearning.ai.service;

import com.elearning.ai.common.exception.AppException;
import com.elearning.ai.common.exception.ErrorCode;
import com.elearning.ai.dto.AiCapabilitiesResponse;
import com.elearning.ai.provider.AiProviderProperties;
import org.springframework.stereotype.Service;

@Service
public class AiPreparationService {

    public static final int MAX_MESSAGE_LENGTH = 4000;

    private final AiProviderProperties properties;

    public AiPreparationService(AiProviderProperties properties) {
        this.properties = properties;
    }

    public AiCapabilitiesResponse getCapabilities() {
        return new AiCapabilitiesResponse(properties.isConfigured(), true, MAX_MESSAGE_LENGTH);
    }

    public void requireAvailable() {
        if (!properties.isConfigured()) throw new AppException(ErrorCode.AI_NOT_AVAILABLE);
    }
}
