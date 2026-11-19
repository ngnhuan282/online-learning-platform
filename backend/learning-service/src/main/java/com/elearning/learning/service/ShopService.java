package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.ShopModels.*;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.HashSet;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ShopService {

    public static final int FREEZE_CAPACITY = 7;
    private final JdbcTemplate jdbc;
    private final EngagementService engagement;
    private final Clock clock;

    public ShopService(JdbcTemplate jdbc, EngagementService engagement, Clock clock) {
        this.jdbc = jdbc;
        this.engagement = engagement;
        this.clock = clock;
    }

    public State state(long userId) {
        var summary = engagement.summary(userId);
        Set<String> owned = new HashSet<>(
            jdbc.queryForList("SELECT item_code FROM shop_inventory WHERE user_id = ?", String.class, userId)
        );
        var items = jdbc.query(
            "SELECT * FROM shop_items WHERE active = TRUE OR code IN (SELECT item_code FROM shop_inventory WHERE user_id=?) ORDER BY position, code",
            (row, i) ->
                new Item(
                    row.getString("code"),
                    row.getString("name_key"),
                    row.getString("item_type"),
                    row.getString("rarity"),
                    row.getInt("price"),
                    row.getObject("original_price", Integer.class),
                    row.getString("asset_key"),
                    owned.contains(row.getString("code")),
                    row.getString("code").equals(summary.activeFrame()) ||
                        row.getString("code").equals(summary.activeBackground()),
                    row.getBoolean("active")
                ),
            userId
        );
        return new State(
            summary.gems(),
            summary.streakFreezes(),
            FREEZE_CAPACITY,
            summary.activeFrame(),
            summary.activeBackground(),
            items,
            summary.dailyGems()
        );
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public Purchase purchase(long userId, PurchaseRequest request) {
        // Reconcile days before adding new freezes; purchases never repair an already broken streak.
        State before = state(userId);
        jdbc.queryForList("SELECT code FROM shop_items WHERE code=? FOR UPDATE", request.itemCode());
        before = state(userId);
        var prior = jdbc.query(
            "SELECT item_code, gems_spent FROM shop_purchases WHERE user_id = ? AND request_id = ?",
            (row, i) -> new Receipt(row.getString(1), row.getInt(2)),
            userId,
            request.requestId()
        );
        if (!prior.isEmpty()) {
            if (!prior.getFirst().code().equals(request.itemCode())) throw new AppException(
                ErrorCode.CONFLICT
            );
            return new Purchase(request.itemCode(), prior.getFirst().spent(), false, state(userId));
        }
        Item item = before
            .items()
            .stream()
            .filter(value -> value.active() && value.code().equals(request.itemCode()))
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (item.owned()) {
            recordPurchase(userId, request.requestId(), item.code(), 0);
            return new Purchase(item.code(), 0, true, before);
        }
        if ("FREEZE".equals(item.itemType()) && before.streakFreezes() >= FREEZE_CAPACITY) {
            throw new AppException(ErrorCode.INVENTORY_FULL);
        }
        if (before.gems() < item.price()) throw new AppException(ErrorCode.INSUFFICIENT_GEMS);
        jdbc.update("UPDATE learner_profiles SET gems = gems - ? WHERE user_id = ?", item.price(), userId);
        if ("FREEZE".equals(item.itemType())) {
            jdbc.update(
                "UPDATE learner_profiles SET streak_freezes = streak_freezes + 1 WHERE user_id = ?",
                userId
            );
        } else {
            jdbc.update(
                "INSERT INTO shop_inventory (user_id, item_code, acquired_at) VALUES (?, ?, ?)",
                userId,
                item.code(),
                Timestamp.from(clock.instant())
            );
        }
        recordPurchase(userId, request.requestId(), item.code(), item.price());
        return new Purchase(item.code(), item.price(), false, state(userId));
    }

    public State equip(long userId, EquipRequest request) {
        engagement.lockProfile(userId);
        if (request.itemCode() != null) {
            long owned = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM shop_inventory i JOIN shop_items s ON s.code = i.item_code
                WHERE i.user_id = ? AND i.item_code = ? AND s.item_type = ?
                """,
                Long.class,
                userId,
                request.itemCode(),
                request.itemType()
            );
            if (owned == 0) throw new AppException(ErrorCode.FORBIDDEN);
        }
        if ("FRAME".equals(request.itemType())) engagement.equipFrame(userId, request.itemCode());
        else if ("BACKGROUND".equals(request.itemType())) {
            jdbc.update(
                "UPDATE learner_profiles SET active_background = ? WHERE user_id = ?",
                request.itemCode(),
                userId
            );
        } else throw new AppException(ErrorCode.BAD_REQUEST);
        return state(userId);
    }

    public State topUp(long userId, TopUpRequest request) {
        engagement.lockProfile(userId);
        if (request.gems() <= 0) throw new AppException(ErrorCode.BAD_REQUEST);
        jdbc.update("UPDATE learner_profiles SET gems = gems + ? WHERE user_id = ?", request.gems(), userId);
        return state(userId);
    }

    public void grantGems(long userId, int gems) {
        engagement.lockProfile(userId);
        if (gems <= 0) throw new AppException(ErrorCode.BAD_REQUEST);
        jdbc.update("UPDATE learner_profiles SET gems = gems + ? WHERE user_id = ?", gems, userId);
    }

    private record Receipt(String code, int spent) {}

    private void recordPurchase(long userId, String requestId, String code, int spent) {
        jdbc.update(
            "INSERT INTO shop_purchases (user_id, request_id, item_code, gems_spent, created_at) VALUES (?, ?, ?, ?, ?)",
            userId,
            requestId,
            code,
            spent,
            Timestamp.from(clock.instant())
        );
    }
}
