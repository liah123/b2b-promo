const pool = require('../db/pool');
const { canRedeem } = require('./reward.service');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function redeem({ rewardId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT reward_id, name, recipe, status FROM rewards WHERE reward_id = $1 FOR UPDATE`,
      [rewardId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      throw httpError(404, '리워드를 찾을 수 없습니다');
    }
    const reward = rows[0];
    if (reward.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      throw httpError(400, '비활성 리워드는 교환할 수 없습니다');
    }

    const { rows: balanceRows } = await client.query(
      `SELECT ingredient_type,
              SUM(CASE WHEN type = 'EARN' THEN amount ELSE -amount END) AS balance
       FROM stamp_transactions
       WHERE user_id = $1
       GROUP BY ingredient_type`,
      [userId]
    );
    const balances = balanceRows.map((r) => ({
      ingredientType: r.ingredient_type,
      balance: Number(r.balance),
    }));

    if (!canRedeem(balances, reward.recipe)) {
      await client.query('ROLLBACK');
      throw httpError(400, '필요한 재료 스탬프가 부족합니다');
    }

    const { rows: inserted } = await client.query(
      `INSERT INTO reward_redemptions (user_id, reward_id) VALUES ($1, $2)
       RETURNING redemption_id, user_id, reward_id, redeemed_at`,
      [userId, rewardId]
    );
    const redemption = inserted[0];

    for (const item of reward.recipe) {
      await client.query(
        `INSERT INTO stamp_transactions (user_id, ingredient_type, type, amount, reason, related_redemption_id)
         VALUES ($1, $2, 'USE', $3, '쿠폰 사용', $4)`,
        [userId, item.ingredientType, item.quantity, redemption.redemption_id]
      );
    }

    await client.query('COMMIT');
    console.log('redemption create success: redemptionId=' + redemption.redemption_id);

    return {
      redemptionId: redemption.redemption_id,
      rewardId: redemption.reward_id,
      userId: redemption.user_id,
      rewardName: reward.name,
      redeemedAt: redemption.redeemed_at,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function listMyRedemptions(userId) {
  const { rows: redemptionRows } = await pool.query(
    `SELECT rr.redemption_id, rr.reward_id, rr.redeemed_at, r.name AS reward_name
     FROM reward_redemptions rr
     JOIN rewards r ON r.reward_id = rr.reward_id
     WHERE rr.user_id = $1
     ORDER BY rr.redeemed_at DESC`,
    [userId]
  );
  if (redemptionRows.length === 0) return [];

  const redemptionIds = redemptionRows.map((r) => r.redemption_id);
  const { rows: txRows } = await pool.query(
    `SELECT related_redemption_id, ingredient_type, amount
     FROM stamp_transactions
     WHERE related_redemption_id = ANY($1::bigint[])`,
    [redemptionIds]
  );

  const grouped = new Map();
  for (const tx of txRows) {
    const key = tx.related_redemption_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ ingredientType: tx.ingredient_type, quantity: Number(tx.amount) });
  }

  return redemptionRows.map((r) => ({
    redemptionId: r.redemption_id,
    rewardId: r.reward_id,
    rewardName: r.reward_name,
    redeemedAt: r.redeemed_at,
    usedIngredients: grouped.get(r.redemption_id) ?? [],
  }));
}

module.exports = { redeem, listMyRedemptions };
