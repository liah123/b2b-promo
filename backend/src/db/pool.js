require('dotenv').config();
const { Pool } = require('pg');

// ponytail: 기본 Pool 옵션 그대로 사용, 3일 MVP 규모에서 커넥션 풀 튜닝은 불필요
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
