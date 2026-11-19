package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.ShopModels.InternalGemGrantRequest;
import com.elearning.learning.security.InternalServiceAuthenticator;
import com.elearning.learning.service.ShopService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/learning")
public class InternalShopController {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Service-Token";

    private final ShopService shop;
    private final InternalServiceAuthenticator authenticator;

    public InternalShopController(
        ShopService shop,
        InternalServiceAuthenticator authenticator
    ) {
        this.shop = shop;
        this.authenticator = authenticator;
    }

    @PostMapping("/gem-topup")
    public ApiResponse<Map<String, Object>> grantGems(
        @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String token,
        @Valid @RequestBody InternalGemGrantRequest request
    ) {
        authenticator.requireValid(token);
        shop.grantGems(request.orderCode(), request.userId(), request.gems());
        return ApiResponse.success(Map.of("userId", request.userId()));
    }
}
