const fs = require('fs');
const path = require('path');
const pool = require('./pool');

// ponytail: 마이그레이션 이력 테이블 없이 파일명 정렬 순서대로 매번 전체 실행.
// 재실행/롤백이 필요해지면 그때 이력 테이블(schema_migrations)을 추가한다.
async function migrate() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`applying ${file}...`);
    await pool.query(sql);
  }

  console.log(`done: ${files.length} migration(s) applied`);
  await pool.end();
}

migrate().catch((err) => {
  console.error('migration failed:', err.message);
  process.exit(1);
});
