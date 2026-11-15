ALTER TABLE learner_profiles ADD COLUMN streak_freezes INT NOT NULL DEFAULT 0;
ALTER TABLE learner_profiles ADD COLUMN streak_accounted_through DATE NULL;
ALTER TABLE learner_profiles ADD COLUMN active_background VARCHAR(32) NULL;
ALTER TABLE learner_profiles ADD CONSTRAINT chk_streak_freezes CHECK (streak_freezes BETWEEN 0 AND 7);

UPDATE learner_profiles SET streak_accounted_through = last_activity_date;

CREATE TABLE shop_items (
    code VARCHAR(32) PRIMARY KEY,
    name_key VARCHAR(120) NOT NULL,
    item_type VARCHAR(16) NOT NULL,
    rarity VARCHAR(16) NOT NULL,
    price INT NOT NULL,
    original_price INT NULL,
    asset_key VARCHAR(64) NOT NULL,
    position INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_shop_item_type CHECK (item_type IN ('FRAME', 'BACKGROUND', 'FREEZE')),
    CONSTRAINT chk_shop_price CHECK (price >= 0)
);

INSERT INTO shop_items (code, name_key, item_type, rarity, price, original_price, asset_key, position) VALUES
    ('STREAK_FREEZE', 'Streak freeze', 'FREEZE', 'RARE', 25, NULL, 'freeze', 0),
    ('BACKGROUND_SKY', 'Bầu trời khởi đầu', 'BACKGROUND', 'RARE', 0, 50, 'sky', 1),
    ('BACKGROUND_CAMPUS', 'Hẹn gặp ở giảng đường', 'BACKGROUND', 'EPIC', 100, NULL, 'campus-sunrise', 2),
    ('BACKGROUND_LIBRARY', 'Thư viện ánh trăng', 'BACKGROUND', 'EPIC', 120, NULL, 'moonlit-library', 3),
    ('FRAME_CLASSIC', 'Vòng sáng khởi đầu', 'FRAME', 'RARE', 0, 30, 'classic', 4),
    ('FRAME_KITTY', 'Mèo nhỏ chăm học', 'FRAME', 'EPIC', 150, NULL, 'kitty-scholar', 5),
    ('FRAME_KOALA', 'Koala vườn xanh', 'FRAME', 'EPIC', 180, NULL, 'koala-garden', 6),
    ('FRAME_OWL', 'Cú mèo phù thủy', 'FRAME', 'EPIC', 250, NULL, 'owl-wizard', 7),
    ('FRAME_BUNNY', 'Thỏ hoa anh đào', 'FRAME', 'EPIC', 180, NULL, 'bunny-bloom', 8);

CREATE TABLE shop_inventory (
    user_id BIGINT NOT NULL,
    item_code VARCHAR(32) NOT NULL,
    acquired_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, item_code),
    CONSTRAINT fk_inventory_profile FOREIGN KEY (user_id) REFERENCES learner_profiles(user_id),
    CONSTRAINT fk_inventory_item FOREIGN KEY (item_code) REFERENCES shop_items(code)
);

CREATE TABLE shop_purchases (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    request_id VARCHAR(64) NOT NULL,
    item_code VARCHAR(32) NOT NULL,
    gems_spent INT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_shop_purchase_request UNIQUE (user_id, request_id),
    CONSTRAINT fk_purchase_profile FOREIGN KEY (user_id) REFERENCES learner_profiles(user_id),
    CONSTRAINT fk_purchase_item FOREIGN KEY (item_code) REFERENCES shop_items(code)
);

CREATE TABLE learning_frozen_days (
    user_id BIGINT NOT NULL,
    frozen_date DATE NOT NULL,
    used_at TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, frozen_date),
    CONSTRAINT fk_frozen_day_profile FOREIGN KEY (user_id) REFERENCES learner_profiles(user_id)
);
