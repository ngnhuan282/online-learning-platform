package com.elearning.learning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;

public final class ShopModels {

    private ShopModels() {}

    public record Item(
        String code,
        String nameKey,
        String itemType,
        String rarity,
        int price,
        Integer originalPrice,
        String assetKey,
        boolean owned,
        boolean equipped,
        boolean active
    ) {}

    public record State(
        int gems,
        int streakFreezes,
        int freezeCapacity,
        String activeFrame,
        String activeBackground,
        List<Item> items,
        int dailyGems
    ) {}

    public record PurchaseRequest(
        @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,31}") String itemCode,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{16,64}") String requestId
    ) {}

    public record EquipRequest(
        @NotNull @Pattern(regexp = "FRAME|BACKGROUND") String itemType,
        @Pattern(regexp = "[A-Z][A-Z0-9_]{1,31}") String itemCode
    ) {}

    public record Purchase(String itemCode, int gemsSpent, boolean alreadyOwned, State state) {}
}
