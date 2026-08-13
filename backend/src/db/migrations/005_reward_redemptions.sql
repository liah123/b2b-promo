CREATE TABLE reward_redemptions (
    redemption_id BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(user_id),
    reward_id     BIGINT NOT NULL REFERENCES rewards(reward_id),
    redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reward_redemptions_user ON reward_redemptions(user_id);
