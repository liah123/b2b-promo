CREATE TABLE rewards (
    reward_id   BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    recipe      JSONB NOT NULL, -- [{ingredientType, quantity}] 재료별 필요 수량 목록
    status      VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE'))
);
