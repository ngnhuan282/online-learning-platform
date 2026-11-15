package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.CommunityModels.*;
import com.elearning.learning.service.CommunityService;
import com.elearning.learning.service.CurrentProfileClient;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/community")
public class CommunityController {

    private final CommunityService community;
    private final CurrentProfileClient profiles;

    public CommunityController(CommunityService community, CurrentProfileClient profiles) {
        this.community = community;
        this.profiles = profiles;
    }

    @GetMapping("/topics")
    public ApiResponse<?> topics() {
        return ApiResponse.success(community.topics());
    }

    @GetMapping("/posts")
    public ApiResponse<?> posts(
        @RequestParam(required = false) Long topicId,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String kind,
        @RequestParam(defaultValue = "false") boolean unanswered,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(community.posts(topicId, keyword, kind, unanswered, page, size));
    }

    @GetMapping("/posts/{id}")
    public ApiResponse<Post> get(@PathVariable long id) {
        return ApiResponse.success(community.get(id));
    }

    @PostMapping("/posts")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public ApiResponse<Post> create(
        Authentication auth,
        @Valid @RequestBody PostRequest request,
        @RequestHeader(value = "Authorization", required = false) String token
    ) {
        return ApiResponse.success(community.create(userId(auth), request, profiles.current(token)));
    }

    @PutMapping("/posts/{id}")
    public ApiResponse<Post> update(
        Authentication auth,
        @PathVariable long id,
        @Valid @RequestBody PostRequest request
    ) {
        return ApiResponse.success(community.update(userId(auth), admin(auth), id, request));
    }

    @DeleteMapping("/posts/{id}")
    public ApiResponse<?> delete(Authentication auth, @PathVariable long id) {
        community.delete(userId(auth), admin(auth), id);
        return ApiResponse.success(null);
    }

    @PatchMapping("/posts/{id}/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Post> locked(@PathVariable long id, @Valid @RequestBody LockRequest request) {
        return ApiResponse.success(community.setLocked(id, request.locked()));
    }

    @GetMapping("/posts/{id}/comments")
    public ApiResponse<?> comments(
        @PathVariable long id,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(community.comments(id, page, size));
    }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public ApiResponse<Comment> addComment(
        Authentication auth,
        @PathVariable long id,
        @Valid @RequestBody CommentRequest request,
        @RequestHeader(value = "Authorization", required = false) String token
    ) {
        return ApiResponse.success(
            community.addComment(userId(auth), admin(auth), id, request, profiles.current(token))
        );
    }

    @PutMapping("/posts/{id}/comments/{commentId}")
    public ApiResponse<Comment> updateComment(
        Authentication auth,
        @PathVariable long id,
        @PathVariable long commentId,
        @Valid @RequestBody CommentRequest request
    ) {
        return ApiResponse.success(
            community.updateComment(userId(auth), admin(auth), id, commentId, request)
        );
    }

    @DeleteMapping("/posts/{id}/comments/{commentId}")
    public ApiResponse<?> deleteComment(
        Authentication auth,
        @PathVariable long id,
        @PathVariable long commentId
    ) {
        community.deleteComment(userId(auth), admin(auth), id, commentId);
        return ApiResponse.success(null);
    }

    @PatchMapping("/posts/{id}/answer")
    public ApiResponse<Post> answer(
        Authentication auth,
        @PathVariable long id,
        @Valid @RequestBody AnswerRequest request
    ) {
        return ApiResponse.success(
            community.acceptAnswer(userId(auth), admin(auth), id, request.commentId())
        );
    }

    private long userId(Authentication auth) {
        return Long.parseLong(auth.getName());
    }

    private boolean admin(Authentication auth) {
        return auth
            .getAuthorities()
            .stream()
            .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
    }
}
