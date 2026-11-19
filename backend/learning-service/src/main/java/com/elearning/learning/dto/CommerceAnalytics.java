package com.elearning.learning.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class CommerceAnalytics {

    private CommerceAnalytics() {}

    public record Range(LocalDate from, LocalDate to) {}

    public record Point(Range range, long current, long previous) {}

    public record Report<T, S, D>(
        Range range, Range previousRange, Instant asOf, T current, T previous, S snapshot, List<Point> trend, D details
    ) {}

    public record ProPeriod(long grants, long newMembers, long repeatGrants, long paid, long code, long admin, long revocations) {}

    public record ProSnapshot(long active, long expiringSoon, long expired, long suspended) {}

    public record Grant(long id, long userId, String source, String planCode, int months, Instant grantedAt, Instant revokedAt) {}

    public record Code(long id, String maskedCode, String planCode, String status, Instant createdAt, Instant redeemedAt, Instant expiresAt) {}

    public record CodeReport(long created, long redeemed, List<Code> recent) {}

    public record ProDetails(List<Grant> recentGrants, CodeReport codes) {}

    public record GemPeriod(
        long issued, long spent, long daily, long rewards, long topups, long adminCredits, long adminDebits,
        long itemSpend, long freezeSpend, long legacyActivityDays
    ) {}

    public record GemSnapshot(long balance, long walletsWithBalance) {}

    public record Adjustment(long id, long userId, long actorId, long delta, String reason, Instant createdAt) {}

    public record ShopPeriod(long purchases, long gemSpent, long buyers, long freezePurchases, long freezeUses, long unclassifiedReceipts) {}

    public record ShopSnapshot(long ownedItems, long equippedItems, long freezesInWallets, Double equipRate) {}

    public record Item(
        String code, String name, String type, int currentPrice, long purchases, long gemSpent,
        Long owners, Long equipped, Double equipRate
    ) {}
}
