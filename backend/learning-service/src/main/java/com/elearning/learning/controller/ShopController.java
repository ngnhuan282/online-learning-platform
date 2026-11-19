package com.elearning.learning.controller;

import com.elearning.learning.common.response.ApiResponse;
import com.elearning.learning.dto.ShopModels.*;
import com.elearning.learning.service.ShopService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/learning/shop")
public class ShopController {

    private final ShopService shop;

    public ShopController(ShopService shop) {
        this.shop = shop;
    }

    @GetMapping
    public ApiResponse<State> state(Principal principal) {
        return ApiResponse.success(shop.state(Long.parseLong(principal.getName())));
    }

    @PostMapping("/purchases")
    public ApiResponse<Purchase> purchase(Principal principal, @Valid @RequestBody PurchaseRequest request) {
        return ApiResponse.success(shop.purchase(Long.parseLong(principal.getName()), request));
    }

    @PostMapping("/equip")
    public ApiResponse<State> equip(Principal principal, @Valid @RequestBody EquipRequest request) {
        return ApiResponse.success(shop.equip(Long.parseLong(principal.getName()), request));
    }

}
