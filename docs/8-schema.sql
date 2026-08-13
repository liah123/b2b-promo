-- Stamp Up DB 스키마 (PostgreSQL 17)
-- 버전: v1.1 (작성일: 2026-08-13, v1.0->v1.1: 근거 문서 버전 갱신, DDL 내용 변경 없음)
-- 근거 문서: docs/8-erd.md (v1.1), docs/1-domain-definition.md (v1.5), docs/3-PRD.md (v1.4)
-- 실행 순서대로 정의 (FK 참조 순서 고려). 상태값(enum성 컬럼)은 CHECK 제약으로 허용값을 제한한다.

CREATE TABLE users (
    user_id     BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    role        VARCHAR(20)  NOT NULL CHECK (role IN ('CUSTOMER', 'ADMIN')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

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

CREATE TABLE mission_participations (
    participation_id BIGSERIAL PRIMARY KEY,
    mission_id       BIGINT NOT NULL REFERENCES missions(mission_id),
    user_id          BIGINT NOT NULL REFERENCES users(user_id),
    status           VARCHAR(20) NOT NULL CHECK (status IN ('JOINED', 'COMPLETED')),
    joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ,
    UNIQUE (mission_id, user_id) -- 동일 (미션, 사용자) 조합 중복 참여 방지
);

CREATE TABLE rewards (
    reward_id   BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    recipe      JSONB NOT NULL, -- [{ingredientType, quantity}] 재료별 필요 수량 목록
    status      VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE reward_redemptions (
    redemption_id BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(user_id),
    reward_id     BIGINT NOT NULL REFERENCES rewards(reward_id),
    redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(user_id),
    token       VARCHAR(500) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ
);

-- 주요 조회 패턴에 맞춘 인덱스 (PRD 5.2 기준)
CREATE INDEX idx_stamp_transactions_user_ingredient ON stamp_transactions(user_id, ingredient_type);
CREATE INDEX idx_mission_participations_user ON mission_participations(user_id);
CREATE INDEX idx_reward_redemptions_user ON reward_redemptions(user_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- mission_participations(mission_id, user_id) UK, users.email UK, refresh_tokens.token UK는
-- 위 UNIQUE 제약으로 이미 커버되며 PostgreSQL이 자동으로 인덱스를 생성하므로 별도 인덱스 불필요.
