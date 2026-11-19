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
    void readRoutesForwardPaginationFiltersAndTargetIds() throws Exception {
        ok("GET", "/shop/items", null); verify(service).items();
        ok("GET", "/shop/purchases?userId=7&page=2&size=5", null); verify(service).purchases(7L, 2, 5);
        ok("GET", "/engagement/learners?keyword=learn&page=1&size=5", null); verify(service).learners("learn", 1, 5);
        ok("GET", "/engagement/learners/7", null); verify(service).learner(7);
        ok("GET", "/engagement/learners/7/adjustments", null); verify(service).adjustments(7);
        ok("GET", "/engagement/learners/7/inventory", null); verify(service).inventory(7);
        ok("GET", "/engagement/settings", null); verify(service).settings();
        ok("GET", "/engagement/rewards", null); verify(service).rewards();
        ok("GET", "/pro/members?keyword=pro&page=1&size=5", null); verify(service).members("pro", 1, 5);
        when(pro.membership(7)).thenReturn(new Membership(7, false, null, null, Instant.now(), false, 0));
        ok("GET", "/pro/members/7", null); verify(service).requireProTarget(7); verify(pro).membership(7); verify(service).grants(7);
        ok("GET", "/community/posts?hidden=true&page=1&size=5", null); verify(service).posts(true, 1, 5);
        ok("GET", "/community/posts/8/comments", null); verify(service).comments(8);
        ok("GET", "/audit", null); verify(service).audit();
    }

    @Test
    void itemAndInventoryWritesUseTheAuthenticatedActorAndKeepVersions() throws Exception {
        var item = new ItemRequest("FRAME_TEST", "Test", "FRAME", "RARE", 5, null, "classic", 0, true, 2, "support");
        ok("POST", "/shop/items", item); verify(service).saveItem(null, item, 99);
        ok("PUT", "/shop/items/FRAME_TEST", item); verify(service).saveItem("FRAME_TEST", item, 99);
        var deletion = new DeleteRequest(2, "support");
        ok("DELETE", "/shop/items/FRAME_TEST", deletion); verify(service).deleteItem("FRAME_TEST", deletion, 99, false);
        ok("POST", "/shop/items/FRAME_TEST/restore", deletion); verify(service).deleteItem("FRAME_TEST", deletion, 99, true);
        var inventory = new InventoryRequest(true, "gift");
        ok("PUT", "/engagement/learners/7/inventory/FRAME_TEST", inventory); verify(service).saveInventory(7, "FRAME_TEST", inventory, 99);
        var adjustment = new AdjustmentRequest(UUID.randomUUID().toString(), 5, 10, null, 0, null, "support");
        ok("POST", "/engagement/learners/7/adjustments", adjustment); verify(service).adjust(7, adjustment, actor);
    }

    @Test
    void rewardAndSettingsWritesPreserveTheDefinitionAndAuditReason() throws Exception {
        var reward = new RewardDefinitionRequest("STREAK_TEST", "Test reward", "STREAK", 3, 5, true, 0, "support");
        ok("POST", "/engagement/rewards", reward); verify(service).createReward(reward, 99);
        ok("PUT", "/engagement/rewards/STREAK_TEST/definition", reward); verify(service).updateRewardDefinition("STREAK_TEST", reward, 99);
        var deletion = new DeleteRequest(0, "support");
        ok("DELETE", "/engagement/rewards/STREAK_TEST", deletion); verify(service).deleteReward("STREAK_TEST", deletion, 99, false);
        ok("POST", "/engagement/rewards/STREAK_TEST/restore", deletion); verify(service).deleteReward("STREAK_TEST", deletion, 99, true);
        var policy = new RewardRequest(10, true, 0, "policy");
        ok("PUT", "/engagement/rewards/STREAK_TEST", policy); verify(service).saveReward("STREAK_TEST", policy, 99);
        var settings = new SettingsRequest(20, 10, 5, 100, 0, "policy");
        ok("PUT", "/engagement/settings", settings); verify(service).saveSettings(settings, 99);
    }

    @Test
    void communityCrudKeepsParentIdsAndDistinguishesDeleteFromRestore() throws Exception {
        var post = new PostContentRequest(1, "DISCUSSION", "Title", "Body", false, 0, "support");
        ok("POST", "/community/posts", post); verify(service).savePost(null, post, 99);
        ok("PUT", "/community/posts/8", post); verify(service).savePost(8L, post, 99);
        var comment = new CommentContentRequest("Comment", 0, "support");
        ok("POST", "/community/posts/8/comments", comment); verify(service).saveComment(8, null, comment, 99);
        ok("PUT", "/community/posts/8/comments/9", comment); verify(service).saveComment(8, 9L, comment, 99);
        var deletion = new DeleteRequest(0, "support");
        ok("DELETE", "/community/posts/8", deletion); verify(service).deletePost(8, deletion, 99, false);
        ok("POST", "/community/posts/8/restore", deletion); verify(service).deletePost(8, deletion, 99, true);
        ok("DELETE", "/community/posts/8/comments/9", deletion); verify(service).deleteComment(8, 9, deletion, 99, false);
        ok("POST", "/community/posts/8/comments/9/restore", deletion); verify(service).deleteComment(8, 9, deletion, 99, true);
        var moderation = new ModerationRequest(true, false, "moderation");
        ok("PATCH", "/community/posts/8", moderation); verify(service).moderate(8, moderation, 99);
        ok("PATCH", "/community/posts/8/comments/9", moderation); verify(service).moderateComment(8, 9, moderation, 99);
    }

    @Test
    void proGrantChangesUseTheTargetMemberAndAuthenticatedAdministrator() throws Exception {
        var grant = new GrantRequest("PRO_MONTH", UUID.randomUUID().toString(), "support");
        ok("POST", "/pro/members/7/grants", grant); verify(service).requireProTarget(7); verify(pro).grantAdmin(7, 99, grant);
        var update = new GrantUpdateRequest("PRO_YEAR", 0, "support");
        ok("PUT", "/pro/members/7/grants/8", update); verify(pro).updateAdminGrant(7, 8, 99, update);
        ok("POST", "/pro/members/7/grants/8/revoke", new ReasonRequest("support")); verify(pro).revokeAdmin(7, 8, 99, "support");
        var suspension = new SuspensionRequest(true, 0, "support");
        ok("PATCH", "/pro/members/7/suspension", suspension); verify(pro).suspend(7, 99, suspension);
    }

    @Test
    void invalidBodiesNeverReachTheMutationService() throws Exception {
        mvc.perform(request(HttpMethod.POST, "/api/v1/learning/admin/shop/items").principal(actor)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(service, pro);
    }

    void ok(String method, String path, Object body) throws Exception {
        var request = request(HttpMethod.valueOf(method), "/api/v1/learning/admin" + path).principal(actor);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        mvc.perform(request).andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
    }
}
