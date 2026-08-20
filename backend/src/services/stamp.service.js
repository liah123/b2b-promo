const pool = require('../db/pool');
const { mapRows } = require('./mapRow');

async function getBalances(userId) {
  const { rows } = await pool.query(
    `SELECT ingredient_type,
            SUM(CASE WHEN type = 'EARN' THEN amount ELSE -amount END) AS balance
     FROM stamp_transactions
     WHERE user_id = $1
     GROUP BY ingredient_type`,
    [userId]
  );
  return rows.map((r) => ({ ingredientType: r.ingredient_type, balance: Number(r.balance) }));
}

async function getHistory(userId) {
  const { rows } = await pool.query(
    `SELECT transaction_id, user_id, ingredient_type, type, amount, reason,
            related_mission_id, related_redemption_id, created_at
     FROM stamp_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return mapRows(rows);
}

module.exports = { getBalances, getHistory };
