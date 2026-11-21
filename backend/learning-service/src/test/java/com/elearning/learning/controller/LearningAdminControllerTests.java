package com.elearning.learning.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.elearning.learning.dto.LearningAdminModels.*;
import com.elearning.learning.dto.ProModels.Membership;
import com.elearning.learning.service.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

class LearningAdminControllerTests {
    final LearningAdminService service = mock(LearningAdminService.class);
    final ProMembershipService pro = mock(ProMembershipService.class);
    final UsernamePasswordAuthenticationToken actor = new UsernamePasswordAuthenticationToken("99", "unused");
    final JsonMapper json = new JsonMapper();
    final MockMvc mvc = MockMvcBuilders.standaloneSetup(new LearningAdminController(service, pro)).build();

    @Test
    void list_whenTargetIdsFiltersAndPaginationAreProvided_shouldForwardParametersToService() throws Exception {
        // Arrange
        when(pro.membership(7)).thenReturn(new Membership(7, false, null, null, Instant.now(), false, 0));

        // Act
        ok("GET", "/shop/items", null);
        ok("GET", "/shop/purchases?userId=7&page=2&size=5", null);
        ok("GET", "/engagement/learners?keyword=learn&page=1&size=5", null);
        ok("GET", "/engagement/learners/7", null);
        ok("GET", "/engagement/learners/7/adjustments", null);
        ok("GET", "/engagement/learners/7/inventory", null);
        ok("GET", "/engagement/settings", null);
        ok("GET", "/engagement/rewards", null);
        ok("GET", "/pro/members?keyword=pro&page=1&size=5", null);
        ok("GET", "/pro/members/7", null);
        ok("GET", "/community/posts?hidden=true&page=1&size=5", null);
        ok("GET", "/community/posts/8/comments", null);
        ok("GET", "/audit", null);

        // Assert
        verify(service).items();
        verify(service).purchases(7L, 2, 5);
        verify(service).learners("learn", 1, 5);
        verify(service).learner(7);
        verify(service).adjustments(7);
        verify(service).inventory(7);
        verify(service).settings();
        verify(service).rewards();
        verify(service).members("pro", 1, 5);
        verify(service).requireProTarget(7);
        verify(pro).membership(7);
        verify(service).grants(7);
        verify(service).posts(true, 1, 5);
        verify(service).comments(8);
        verify(service).audit();
    }

    @Test
    void saveItem_whenAuthenticatedAdminWritesInventory_shouldUseActorAndPreserveVersions() throws Exception {
        // Arrange
        var item = new ItemRequest("FRAME_TEST", "Test", "FRAME", "RARE", 5, null, "classic", 0, true, 2, "support");
        var deletion = new DeleteRequest(2, "support");
        var inventory = new InventoryRequest(true, "gift");
        var adjustment = new AdjustmentRequest(UUID.randomUUID().toString(), 5, 10, null, 0, null, "support");

        // Act
        ok("POST", "/shop/items", item);
        ok("PUT", "/shop/items/FRAME_TEST", item);
        ok("DELETE", "/shop/items/FRAME_TEST", deletion);
        ok("POST", "/shop/items/FRAME_TEST/restore", deletion);
        ok("PUT", "/engagement/learners/7/inventory/FRAME_TEST", inventory);
        ok("POST", "/engagement/learners/7/adjustments", adjustment);

        // Assert
        verify(service).saveItem(null, item, 99);
        verify(service).saveItem("FRAME_TEST", item, 99);
        verify(service).deleteItem("FRAME_TEST", deletion, 99, false);
        verify(service).deleteItem("FRAME_TEST", deletion, 99, true);
        verify(service).saveInventory(7, "FRAME_TEST", inventory, 99);
        verify(service).adjust(7, adjustment, actor);
    }

    @Test
    void saveReward_whenRewardOrSettingsChange_shouldPreserveDefinitionAndAuditReason() throws Exception {
        // Arrange
        var reward = new RewardDefinitionRequest("STREAK_TEST", "Test reward", "STREAK", 3, 5, true, 0, "support");
        var deletion = new DeleteRequest(0, "support");
        var policy = new RewardRequest(10, true, 0, "policy");
        var settings = new SettingsRequest(20, 10, 5, 100, 0, "policy");

        // Act
        ok("POST", "/engagement/rewards", reward);
        ok("PUT", "/engagement/rewards/STREAK_TEST/definition", reward);
        ok("DELETE", "/engagement/rewards/STREAK_TEST", deletion);
        ok("POST", "/engagement/rewards/STREAK_TEST/restore", deletion);
        ok("PUT", "/engagement/rewards/STREAK_TEST", policy);
        ok("PUT", "/engagement/settings", settings);

        // Assert
        verify(service).createReward(reward, 99);
        verify(service).updateRewardDefinition("STREAK_TEST", reward, 99);
        verify(service).deleteReward("STREAK_TEST", deletion, 99, false);
        verify(service).deleteReward("STREAK_TEST", deletion, 99, true);
        verify(service).saveReward("STREAK_TEST", policy, 99);
        verify(service).saveSettings(settings, 99);
    }

    @Test
    void updatePost_whenAdminEditsDeletesOrRestoresContent_shouldKeepParentIdsAndDistinguishOperations() throws Exception {
        // Arrange
        var post = new PostContentRequest(1, "DISCUSSION", "Title", "Body", false, 0, "support");
        var comment = new CommentContentRequest("Comment", 0, "support");
        var deletion = new DeleteRequest(0, "support");
        var moderation = new ModerationRequest(true, false, "moderation");

        // Act
        ok("POST", "/community/posts", post);
        ok("PUT", "/community/posts/8", post);
        ok("POST", "/community/posts/8/comments", comment);
        ok("PUT", "/community/posts/8/comments/9", comment);
        ok("DELETE", "/community/posts/8", deletion);
        ok("POST", "/community/posts/8/restore", deletion);
        ok("DELETE", "/community/posts/8/comments/9", deletion);
        ok("POST", "/community/posts/8/comments/9/restore", deletion);
        ok("PATCH", "/community/posts/8", moderation);
        ok("PATCH", "/community/posts/8/comments/9", moderation);

        // Assert
        verify(service).savePost(null, post, 99);
        verify(service).savePost(8L, post, 99);
        verify(service).saveComment(8, null, comment, 99);
        verify(service).saveComment(8, 9L, comment, 99);
        verify(service).deletePost(8, deletion, 99, false);
        verify(service).deletePost(8, deletion, 99, true);
        verify(service).deleteComment(8, 9, deletion, 99, false);
        verify(service).deleteComment(8, 9, deletion, 99, true);
        verify(service).moderate(8, moderation, 99);
        verify(service).moderateComment(8, 9, moderation, 99);
    }

    @Test
    void updateGrant_whenAdministratorAdjustsMembership_shouldForwardTargetAndActor() throws Exception {
        // Arrange
        var grant = new GrantRequest("PRO_MONTH", UUID.randomUUID().toString(), "support");
        var update = new GrantUpdateRequest("PRO_YEAR", 0, "support");
        var suspension = new SuspensionRequest(true, 0, "support");

        // Act
        ok("POST", "/pro/members/7/grants", grant);
        ok("PUT", "/pro/members/7/grants/8", update);
        ok("POST", "/pro/members/7/grants/8/revoke", new ReasonRequest("support"));
        ok("PATCH", "/pro/members/7/suspension", suspension);

        // Assert
        var operations = inOrder(service, pro);
        operations.verify(service).requireProTarget(7);
        operations.verify(pro).grantAdmin(7, 99, grant);
        operations.verify(pro).updateAdminGrant(7, 8, 99, update);
        operations.verify(pro).revokeAdmin(7, 8, 99, "support");
        operations.verify(service).requireProTarget(7);
        operations.verify(pro).suspend(7, 99, suspension);
    }

    @Test
    void mutate_whenBodyIsInvalid_shouldRejectBeforeCallingService() throws Exception {
        // Arrange
        // Act
        mvc.perform(request(HttpMethod.POST, "/api/v1/learning/admin/shop/items").principal(actor)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest());
        // Assert
        verifyNoInteractions(service, pro);
    }

    void ok(String method, String path, Object body) throws Exception {
        var request = request(HttpMethod.valueOf(method), "/api/v1/learning/admin" + path).principal(actor);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        mvc.perform(request).andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
    }
}
