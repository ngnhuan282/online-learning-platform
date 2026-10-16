package com.elearning.ai.service;

import com.elearning.ai.common.exception.AppException;
import com.elearning.ai.common.exception.ErrorCode;
import com.elearning.ai.dto.AiCapabilitiesResponse;
import org.springframework.stereotype.Service;

@Service
public class AiPreparationService {

    public static final int MAX_MESSAGE_LENGTH = 4000;

    public AiCapabilitiesResponse getCapabilities() {
        return new AiCapabilitiesResponse(false, false, MAX_MESSAGE_LENGTH);
    }

    public void requireAvailable() {
        // Do not persist questions or fabricate answers before provider integration.
        throw new AppException(ErrorCode.AI_NOT_AVAILABLE);
    }
}
