CREATE TABLE stamp_transactions (
    transaction_id        BIGSERIAL PRIMARY KEY,
    user_id                BIGINT NOT NULL REFERENCES users(user_id),
    ingredient_type        VARCHAR(50) NOT NULL,
    type                   VARCHAR(10) NOT NULL CHECK (type IN ('EARN', 'USE')),
    amount                 INT NOT NULL CHECK (amount > 0),
    reason                 VARCHAR(50) NOT NULL,
    related_mission_id     BIGINT REFERENCES missions(mission_id),
    related_redemption_id  BIGINT REFERENCES reward_redemptions(redemption_id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stamp_transactions_user_ingredient ON stamp_transactions(user_id, ingredient_type);
