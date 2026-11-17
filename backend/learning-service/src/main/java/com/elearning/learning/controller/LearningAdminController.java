package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.LearningAdminModels.*;
import com.elearning.learning.service.LearningAdminService;
import com.elearning.learning.service.ProMembershipService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
@RequestMapping("/api/v1/learning/admin")
public class LearningAdminController {

    @DeleteMapping("/community/posts/{id}/comments/{commentId}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_DELETE')")
    public ApiResponse<?> deleteComment(
        @PathVariable @Positive long id,
        @PathVariable @Positive long commentId,
        @Valid @RequestBody DeleteRequest request,
        Authentication auth
    ) {
        service.deleteComment(id, commentId, request, actor(auth), false);
        return ApiResponse.success(null);
    }

    @PostMapping("/community/posts/{id}/comments/{commentId}/restore")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_DELETE')")
    public ApiResponse<?> restoreComment(
        @PathVariable @Positive long id,
        @PathVariable @Positive long commentId,
        @Valid @RequestBody DeleteRequest request,
        Authentication auth
    ) {
        service.deleteComment(id, commentId, request, actor(auth), true);
        return ApiResponse.success(null);
    }

    @DeleteMapping("/shop/items/{code}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'SHOP_DELETE')")
    public ApiResponse<?> deleteItem(
        @PathVariable String code,
        @Valid @RequestBody DeleteRequest request,
        Authentication auth
    ) {
        service.deleteItem(code, request, actor(auth), false);
        return ApiResponse.success(null);
    }

    @PostMapping("/shop/items/{code}/restore")
    @PreAuthorize("@learningAdmin.allowed(authentication,'SHOP_DELETE')")
    public ApiResponse<?> restoreItem(
        @PathVariable String code,
        @Valid @RequestBody DeleteRequest request,
        Authentication auth
    ) {
        service.deleteItem(code, request, actor(auth), true);
        return ApiResponse.success(null);
    }

    @PostMapping("/engagement/rewards")
    @PreAuthorize("@learningAdmin.allowed(authentication,'REWARD_CREATE')")
    public ApiResponse<?> createReward(
        @Valid @RequestBody RewardDefinitionRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(service.createReward(request, actor(auth)));
    }

    @PutMapping("/engagement/rewards/{code}/definition")
    @PreAuthorize("@learningAdmin.allowed(authentication,'ENGAGEMENT_CONFIG_UPDATE')")
    public ApiResponse<?> updateReward(
        @PathVariable String code,
        @Valid @RequestBody RewardDefinitionRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(service.updateRewardDefinition(code, request, actor(auth)));
    }

    @DeleteMapping("/engagement/rewards/{code}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'REWARD_DELETE')")
    public ApiResponse<?> deleteReward(
        @PathVariable String code,
        @Valid @RequestBody DeleteRequest request,
        Authentication auth
    ) {
        service.deleteReward(code, request, actor(auth), false);
        return ApiResponse.success(null);
    }

    @PostMapping("/engagement/rewards/{code}/restore")
    @PreAuthorize("@learningAdmin.allowed(authentication,'REWARD_DELETE')")
    public ApiResponse<?> restoreReward(
        @PathVariable String code,
        @Valid @RequestBody DeleteRequest request,
        Authentication auth
    ) {
        service.deleteReward(code, request, actor(auth), true);
        return ApiResponse.success(null);
    }

    @PostMapping("/community/posts")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_CREATE')")
    public ApiResponse<?> createPost(@Valid @RequestBody PostContentRequest request, Authentication auth) {
        return ApiResponse.success(service.savePost(null, request, actor(auth)));
    }

    @PutMapping("/community/posts/{id}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_UPDATE')")
    public ApiResponse<?> updatePost(
        @PathVariable @Positive long id,
        @Valid @RequestBody PostContentRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(service.savePost(id, request, actor(auth)));
    }

    @DeleteMapping("/community/posts/{id}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_DELETE')")
    public ApiResponse<?> deletePost(
        @PathVariable @Positive long id,
        @Valid @RequestBody DeleteRequest request,
        Authentication auth
    ) {
        service.deletePost(id, request, actor(auth), false);
        return ApiResponse.success(null);
    }

    @PostMapping("/community/posts/{id}/restore")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_DELETE')")
    public ApiResponse<?> restorePost(
        @PathVariable @Positive long id,
        @Valid @RequestBody DeleteRequest request,
        Authentication auth
    ) {
        service.deletePost(id, request, actor(auth), true);
        return ApiResponse.success(null);
    }

    @PostMapping("/community/posts/{id}/comments")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_CREATE')")
    public ApiResponse<?> createComment(
        @PathVariable @Positive long id,
        @Valid @RequestBody CommentContentRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(service.saveComment(id, null, request, actor(auth)));
    }

    @PutMapping("/community/posts/{id}/comments/{commentId}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_UPDATE')")
    public ApiResponse<?> updateComment(
        @PathVariable @Positive long id,
        @PathVariable @Positive long commentId,
        @Valid @RequestBody CommentContentRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(service.saveComment(id, commentId, request, actor(auth)));
    }

    @PutMapping("/pro/members/{userId}/grants/{id}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'PRO_MEMBER_MANAGE')")
    public ApiResponse<?> updateGrant(
        @PathVariable @Positive long userId,
        @PathVariable @Positive long id,
        @Valid @RequestBody GrantUpdateRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(pro.updateAdminGrant(userId, id, actor(auth), request));
    }

    @GetMapping("/engagement/learners/{userId}/inventory")
    @PreAuthorize("@learningAdmin.allowed(authentication,'INVENTORY_VIEW')")
    public ApiResponse<?> inventory(@PathVariable @Positive long userId) {
        return ApiResponse.success(service.inventory(userId));
    }

    @PutMapping("/engagement/learners/{userId}/inventory/{code}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'INVENTORY_MANAGE')")
    public ApiResponse<?> inventory(
        @PathVariable @Positive long userId,
        @PathVariable String code,
        @Valid @RequestBody InventoryRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(service.saveInventory(userId, code, request, actor(auth)));
    }

    private final LearningAdminService service;
    private final ProMembershipService pro;

    public LearningAdminController(LearningAdminService service, ProMembershipService pro) {
        this.service = service;
        this.pro = pro;
    }

    @GetMapping("/shop/items")
    @PreAuthorize("@learningAdmin.allowed(authentication,'SHOP_VIEW')")
    public ApiResponse<?> items() {
        return ApiResponse.success(service.items());
    }

    @PostMapping("/shop/items")
    @PreAuthorize("@learningAdmin.allowed(authentication,'SHOP_CREATE')")
    public ApiResponse<?> createItem(@Valid @RequestBody ItemRequest request, Authentication auth) {
        return ApiResponse.success(service.saveItem(null, request, actor(auth)));
    }

    @PutMapping("/shop/items/{code}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'SHOP_UPDATE')")
    public ApiResponse<?> updateItem(
        @PathVariable String code,
        @Valid @RequestBody ItemRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(service.saveItem(code, request, actor(auth)));
    }

    @GetMapping("/shop/purchases")
    @PreAuthorize("@learningAdmin.allowed(authentication,'SHOP_VIEW')")
    public ApiResponse<?> purchases(
        @RequestParam(required = false) @Positive Long userId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(service.purchases(userId, page, size));
    }

    @GetMapping("/engagement/learners")
    @PreAuthorize("@learningAdmin.allowed(authentication,'ENGAGEMENT_VIEW')")
    public ApiResponse<?> learners(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(service.learners(keyword, page, size));
    }

    @GetMapping("/engagement/learners/{userId}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'ENGAGEMENT_VIEW')")
    public ApiResponse<?> learner(@PathVariable @Positive long userId) {
        return ApiResponse.success(service.learner(userId));
    }

    @GetMapping("/engagement/learners/{userId}/adjustments")
    @PreAuthorize("@learningAdmin.allowed(authentication,'ENGAGEMENT_VIEW')")
    public ApiResponse<?> adjustments(@PathVariable @Positive long userId) {
        return ApiResponse.success(service.adjustments(userId));
    }

    @PostMapping("/engagement/learners/{userId}/adjustments")
    @PreAuthorize("@learningAdmin.allowed(authentication,'ENGAGEMENT_VIEW')")
    public ApiResponse<?> adjust(
        @PathVariable @Positive long userId,
        @Valid @RequestBody AdjustmentRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(service.adjust(userId, request, auth));
    }

    @GetMapping("/engagement/settings")
    @PreAuthorize("@learningAdmin.allowed(authentication,'ENGAGEMENT_CONFIG_VIEW')")
    public ApiResponse<?> settings() {
        return ApiResponse.success(service.settings());
    }

    @PutMapping("/engagement/settings")
    @PreAuthorize("@learningAdmin.allowed(authentication,'ENGAGEMENT_CONFIG_UPDATE')")
    public ApiResponse<?> settings(@Valid @RequestBody SettingsRequest request, Authentication auth) {
        return ApiResponse.success(service.saveSettings(request, actor(auth)));
    }

    @GetMapping("/engagement/rewards")
    @PreAuthorize("@learningAdmin.allowed(authentication,'ENGAGEMENT_CONFIG_VIEW')")
    public ApiResponse<?> rewards() {
        return ApiResponse.success(service.rewards());
    }

    @PutMapping("/engagement/rewards/{code}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'ENGAGEMENT_CONFIG_UPDATE')")
    public ApiResponse<?> reward(
        @PathVariable String code,
        @Valid @RequestBody RewardRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(service.saveReward(code, request, actor(auth)));
    }

    @GetMapping("/pro/members")
    @PreAuthorize("@learningAdmin.allowed(authentication,'PRO_MEMBER_VIEW')")
    public ApiResponse<?> members(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(service.members(keyword, page, size));
    }

    @GetMapping("/pro/members/{userId}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'PRO_MEMBER_VIEW')")
    public ApiResponse<?> member(@PathVariable @Positive long userId) {
        service.requireProTarget(userId);
        return ApiResponse.success(
            Map.of("membership", pro.membership(userId), "grants", service.grants(userId))
        );
    }

    @PostMapping("/pro/members/{userId}/grants")
    @PreAuthorize("@learningAdmin.allowed(authentication,'PRO_MEMBER_MANAGE')")
    public ApiResponse<?> grant(
        @PathVariable @Positive long userId,
        @Valid @RequestBody GrantRequest request,
        Authentication auth
    ) {
        service.requireProTarget(userId);
        return ApiResponse.success(pro.grantAdmin(userId, actor(auth), request));
    }

    @PostMapping("/pro/members/{userId}/grants/{id}/revoke")
    @PreAuthorize("@learningAdmin.allowed(authentication,'PRO_MEMBER_MANAGE')")
    public ApiResponse<?> revoke(
        @PathVariable @Positive long userId,
        @PathVariable @Positive long id,
        @Valid @RequestBody ReasonRequest request,
        Authentication auth
    ) {
        return ApiResponse.success(pro.revokeAdmin(userId, id, actor(auth), request.reason()));
    }

    @PatchMapping("/pro/members/{userId}/suspension")
    @PreAuthorize("@learningAdmin.allowed(authentication,'PRO_MEMBER_MANAGE')")
    public ApiResponse<?> suspend(
        @PathVariable @Positive long userId,
        @Valid @RequestBody SuspensionRequest request,
        Authentication auth
    ) {
        service.requireProTarget(userId);
        return ApiResponse.success(pro.suspend(userId, actor(auth), request));
    }

    @GetMapping("/community/posts")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_VIEW')")
    public ApiResponse<?> posts(
        @RequestParam(defaultValue = "false") boolean hidden,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(service.posts(hidden, page, size));
    }

    @PatchMapping("/community/posts/{id}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_MODERATE')")
    public ApiResponse<?> moderate(
        @PathVariable @Positive long id,
        @Valid @RequestBody ModerationRequest request,
        Authentication auth
    ) {
        service.moderate(id, request, actor(auth));
        return ApiResponse.success(null);
    }

    @GetMapping("/community/posts/{id}/comments")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_VIEW')")
    public ApiResponse<?> comments(@PathVariable @Positive long id) {
        return ApiResponse.success(service.comments(id));
    }

    @PatchMapping("/community/posts/{id}/comments/{commentId}")
    @PreAuthorize("@learningAdmin.allowed(authentication,'COMMUNITY_MODERATE')")
    public ApiResponse<?> comment(
        @PathVariable @Positive long id,
        @PathVariable @Positive long commentId,
        @Valid @RequestBody ModerationRequest request,
        Authentication auth
    ) {
        service.moderateComment(id, commentId, request, actor(auth));
        return ApiResponse.success(null);
    }

    @GetMapping("/audit")
    @PreAuthorize("@learningAdmin.allowed(authentication,'AUDIT_VIEW')")
    public ApiResponse<?> audit() {
        return ApiResponse.success(service.audit());
    }

    private long actor(Authentication auth) {
        return Long.parseLong(auth.getName());
    }
}
