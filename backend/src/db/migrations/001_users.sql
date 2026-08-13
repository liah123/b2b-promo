CREATE TABLE users (
    user_id     BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    role        VARCHAR(20)  NOT NULL CHECK (role IN ('CUSTOMER', 'ADMIN')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
