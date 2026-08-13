CREATE TABLE mission_participations (
    participation_id BIGSERIAL PRIMARY KEY,
    mission_id       BIGINT NOT NULL REFERENCES missions(mission_id),
    user_id          BIGINT NOT NULL REFERENCES users(user_id),
    status           VARCHAR(20) NOT NULL CHECK (status IN ('JOINED', 'COMPLETED')),
    joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ,
    UNIQUE (mission_id, user_id) -- 동일 (미션, 사용자) 조합 중복 참여 방지
);

CREATE INDEX idx_mission_participations_user ON mission_participations(user_id);
