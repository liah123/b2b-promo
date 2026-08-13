require('dotenv').config();
const pool = require('../db/pool');

// ponytail: 데모용 1회성 스크립트라 이미 데이터가 있으면 건너뛴다 (별도 --force 옵션 없음)
async function seedDemo() {
  const { rows: existing } = await pool.query('SELECT count(*)::int AS count FROM missions');
  if (existing[0].count > 0) {
    console.log(`missions already has ${existing[0].count} row(s), skip seeding`);
    await pool.end();
    return;
  }

  const { rows: adminRows } = await pool.query(
    "SELECT user_id FROM users WHERE role = 'ADMIN' ORDER BY user_id LIMIT 1"
  );
  if (adminRows.length === 0) {
    throw new Error('ADMIN 계정이 없습니다. 먼저 npm run seed:admin을 실행하세요.');
  }
  const adminId = adminRows[0].user_id;

  await pool.query(
    `INSERT INTO missions (title, description, start_at, end_at, completion_condition, ingredient_type, stamp_count, status, created_by)
     VALUES
       ('방문 적립', '매장 방문 확인 시 스탬프가 적립됩니다.', now() - interval '5 day', now() + interval '10 day', '직원 확인 후 적립', '양파', 2, 'ACTIVE', $1),
       ('신상품 구매 적립', '신상품 구매 확인 시 스탬프가 적립됩니다.', now() + interval '3 day', now() + interval '20 day', '직원 확인 후 적립', '당근', 1, 'PENDING', $1),
       ('지난달 프로모션', '지난달 종료된 프로모션입니다.', now() - interval '40 day', now() - interval '10 day', '직원 확인 후 적립', '감자', 1, 'ENDED', $1)`,
    [adminId]
  );

  await pool.query(
    `INSERT INTO rewards (name, description, recipe, status)
     VALUES
       ('카레', '양파와 당근으로 만드는 카레', $1::jsonb, 'ACTIVE'),
       ('김치찌개', '당근을 넣은 김치찌개', $2::jsonb, 'ACTIVE'),
       ('된장찌개', '단종된 메뉴', $3::jsonb, 'INACTIVE')`,
    [
      JSON.stringify([{ ingredientType: '양파', quantity: 2 }, { ingredientType: '당근', quantity: 1 }]),
      JSON.stringify([{ ingredientType: '당근', quantity: 3 }]),
      JSON.stringify([{ ingredientType: '감자', quantity: 2 }]),
    ]
  );

  console.log('demo seed done: missions 3, rewards 3');
  await pool.end();
}

seedDemo().catch((err) => {
  console.error('demo seed failed:', err.message);
  process.exit(1);
});
