package com.elearning.ai.service;

import com.elearning.ai.common.exception.AppException;
import com.elearning.ai.common.exception.ErrorCode;
import com.elearning.ai.common.response.PageResponse;
import com.elearning.ai.dto.*;
import com.elearning.ai.entity.*;
import com.elearning.ai.provider.GeminiGateway.Reply;
import com.elearning.ai.repository.*;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AiConversationStore {

    private static final String DEFAULT_TITLE = "Cuộc trò chuyện mới";
    private final AiConversationRepository conversations;
    private final AiMessageRepository messages;
    private final EntityManager entityManager;

    public AiConversationStore(
        AiConversationRepository conversations,
        AiMessageRepository messages,
        EntityManager entityManager
    ) {
        this.conversations = conversations;
        this.messages = messages;
        this.entityManager = entityManager;
    }

    public PageResponse<ConversationResponse> list(Long userId, int page, int size) {
        return PageResponse.from(
            conversations
                .findByUserId(
                    userId,
                    PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt", "id"))
                )
                .map(ConversationResponse::from)
        );
    }

    public ConversationResponse owned(Long userId, Long id) {
        return ConversationResponse.from(
            conversations
                .findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND))
        );
    }

    @Transactional
    public ConversationResponse create(Long userId, CreateConversationRequest request, String contextTitle) {
        var conversation = new AiConversation();
        conversation.setUserId(userId);
        conversation.setTitle(
            request.title() == null || request.title().isBlank() ? DEFAULT_TITLE : request.title().strip()
        );
        conversation.setCourseId(request.courseId());
        conversation.setLessonId(request.lessonId());
        conversation.setContextTitle(contextTitle);
        conversation.setCreatedAt(Instant.now());
        conversation.setUpdatedAt(conversation.getCreatedAt());
        return ConversationResponse.from(conversations.save(conversation));
    }

    public PageResponse<MessageResponse> history(Long userId, Long id, int page, int size) {
        owned(userId, id);
        return PageResponse.from(
            messages
                .findByConversationId(id, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")))
                .map(MessageResponse::from)
        );
    }

    @Transactional
    public Reservation reserve(Long userId, Long id, String requestId, String question) {
        var conversation = locked(userId, id);
        List<MessageResponse> previous = messages
            .findByConversationIdAndRequestIdOrderByIdAsc(id, requestId)
            .stream()
            .map(MessageResponse::from)
            .toList();
        if (!previous.isEmpty()) {
            if (!previous.getFirst().content().equals(question)) throw new AppException(ErrorCode.CONFLICT);
            return new Reservation(previous, List.of(), null);
        }
        Instant now = Instant.now();
        if (conversation.getActiveUntil() != null && conversation.getActiveUntil().isAfter(now)) {
            throw new AppException(ErrorCode.AI_REQUEST_IN_PROGRESS);
        }
        // A lease survives restarts; the network call never holds a database transaction open.
        String leaseId = UUID.randomUUID().toString();
        conversation.setActiveRequestId(leaseId);
        conversation.setActiveUntil(now.plusSeconds(120));
        var history = new ArrayList<>(
            messages
                .findByConversationId(id, PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "id")))
                .getContent()
        );
        Collections.reverse(history);
        int characters = history
            .stream()
            .mapToInt(message -> message.getContent().length())
            .sum();
        while (characters > 24000 && history.size() >= 2) {
            characters -= history.removeFirst().getContent().length();
            characters -= history.removeFirst().getContent().length();
        }
        return new Reservation(List.of(), history.stream().map(MessageResponse::from).toList(), leaseId);
    }

    @Transactional
    public List<MessageResponse> finish(
        Long userId,
        Long id,
        String requestId,
        String leaseId,
        String question,
        Reply reply,
        String model
    ) {
        var conversation = locked(userId, id);
        if (!leaseId.equals(conversation.getActiveRequestId())) throw new AppException(ErrorCode.CONFLICT);
        var saved = List.of(
            saveMessage(id, requestId, "USER", question),
            saveMessage(id, requestId, "AI", reply.content())
        );
        conversation.setActiveRequestId(null);
        conversation.setActiveUntil(null);
        conversation.setUpdatedAt(Instant.now());
        if (DEFAULT_TITLE.equals(conversation.getTitle())) {
            conversation.setTitle(question.substring(0, Math.min(100, question.length())));
        }
        usage(userId, id, model, "SUCCESS", reply.inputTokens(), reply.outputTokens());
        return saved;
    }

    @Transactional
    public void fail(Long userId, Long id, String leaseId, String model, String outcome) {
        var conversation = locked(userId, id);
        if (leaseId.equals(conversation.getActiveRequestId())) {
            conversation.setActiveRequestId(null);
            conversation.setActiveUntil(null);
            usage(userId, id, model, outcome, 0, 0);
        }
    }

    private AiConversation locked(Long userId, Long id) {
        return conversations
            .findOwnedForUpdate(id, userId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private MessageResponse saveMessage(Long id, String requestId, String sender, String content) {
        var message = new AiMessage();
        message.setConversationId(id);
        message.setRequestId(requestId);
        message.setSender(sender);
        message.setContent(content);
        message.setCreatedAt(Instant.now());
        return MessageResponse.from(messages.save(message));
    }

    private void usage(Long userId, Long id, String model, String outcome, int input, int output) {
        var usage = new AiUsageLog();
        usage.setUserId(userId);
        usage.setConversationId(id);
        usage.setModel(model);
        usage.setOutcome(outcome);
        usage.setInputTokens(input);
        usage.setOutputTokens(output);
        usage.setCreatedAt(Instant.now());
        entityManager.persist(usage);
    }

    public record Reservation(List<MessageResponse> cached, List<MessageResponse> history, String leaseId) {}
}
