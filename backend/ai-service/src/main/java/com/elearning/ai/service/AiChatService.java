package com.elearning.ai.service;

import com.elearning.ai.common.exception.AppException;
import com.elearning.ai.dto.*;
import com.elearning.ai.provider.AiProviderProperties;
import com.elearning.ai.provider.GeminiGateway;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AiChatService {

    private final AiConversationStore store;
    private final AiPreparationService capabilities;
    private final AiProviderProperties properties;
    private final GeminiGateway provider;
    private final LearningContextClient context;

    public AiChatService(
        AiConversationStore store,
        AiPreparationService capabilities,
        AiProviderProperties properties,
        GeminiGateway provider,
        LearningContextClient context
    ) {
        this.store = store;
        this.capabilities = capabilities;
        this.properties = properties;
        this.provider = provider;
        this.context = context;
    }

    public ConversationResponse create(Long userId, CreateConversationRequest request, String authorization) {
        var reference = context.resolve(request.courseId(), request.lessonId(), authorization);
        return store.create(userId, request, reference.title());
    }

    public List<MessageResponse> send(
        Long userId,
        Long id,
        SendMessageRequest request,
        String authorization
    ) {
        var conversation = store.owned(userId, id);
        capabilities.requireAvailable();
        String question = request.content().strip();
        var reference = context.resolve(conversation.courseId(), conversation.lessonId(), authorization);
        String requestId = request.requestId() == null ? UUID.randomUUID().toString() : request.requestId();
        var reservation = store.reserve(userId, id, requestId, question);
        if (!reservation.cached().isEmpty()) return reservation.cached();
        try {
            var reply = provider.generate(reservation.history(), question, reference.text());
            return store.finish(
                userId,
                id,
                requestId,
                reservation.leaseId(),
                question,
                reply,
                properties.getModel()
            );
        } catch (AppException exception) {
            store.fail(
                userId,
                id,
                reservation.leaseId(),
                properties.getModel(),
                exception.getErrorCode().name()
            );
            throw exception;
        } catch (RuntimeException exception) {
            store.fail(userId, id, reservation.leaseId(), properties.getModel(), "INTERNAL_ERROR");
            throw exception;
        }
    }
}
