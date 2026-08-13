CREATE TABLE missions (
    mission_id           BIGSERIAL PRIMARY KEY,
    title                VARCHAR(200) NOT NULL,
    description          TEXT,
    start_at             TIMESTAMPTZ NOT NULL,
    end_at               TIMESTAMPTZ NOT NULL,
    completion_condition TEXT,
    ingredient_type      VARCHAR(50) NOT NULL,
    stamp_count          INT NOT NULL CHECK (stamp_count > 0),
    status               VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'ENDED')),
    created_by           BIGINT NOT NULL REFERENCES users(user_id)
);
