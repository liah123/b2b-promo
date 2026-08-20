const pool = require('../db/pool');
const { mapRow, mapRows } = require('./mapRow');
const stampService = require('./stamp.service');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

const SELECT_COLUMNS = `reward_id, name, description, recipe, status`;

function assertValidRecipe(recipe) {
  if (!Array.isArray(recipe) || recipe.length < 1) {
    throw httpError(400, 'recipe는 1개 이상의 항목을 가진 배열이어야 합니다');
  }
  for (const item of recipe) {
    if (!item || !item.ingredientType || item.quantity == null || item.quantity <= 0) {
      throw httpError(400, 'recipe 각 항목은 ingredientType과 1 이상의 quantity가 필요합니다');
    }
  }
}

async function createReward({ name, description, recipe }) {
  if (!name) {
    throw httpError(400, 'name은 필수입니다');
  }
  assertValidRecipe(recipe);

  const { rows } = await pool.query(
    `INSERT INTO rewards (name, description, recipe, status)
     VALUES ($1, $2, $3::jsonb, 'ACTIVE')
     RETURNING ${SELECT_COLUMNS}`,
    [name, description ?? null, JSON.stringify(recipe)]
  );
  console.log('reward create success: rewardId=' + rows[0].reward_id);
  return mapRow(rows[0]);
}

async function updateReward(rewardId, patch) {
  const allowed = ['name', 'description', 'recipe'];
  const fields = Object.keys(patch).filter((k) => allowed.includes(k) && patch[k] !== undefined);
  if (fields.length === 0) {
    throw httpError(400, '수정할 필드가 없습니다');
  }
  if (patch.recipe !== undefined) {
    assertValidRecipe(patch.recipe);
  }

  const setClauses = [];
  const values = [];
  fields.forEach((f) => {
    values.push(f === 'recipe' ? JSON.stringify(patch.recipe) : patch[f]);
    setClauses.push(f === 'recipe' ? `recipe = $${values.length}::jsonb` : `${f} = $${values.length}`);
  });
  values.push(rewardId);

  const { rows } = await pool.query(
    `UPDATE rewards SET ${setClauses.join(', ')} WHERE reward_id = $${values.length} RETURNING ${SELECT_COLUMNS}`,
    values
  );
  if (rows.length === 0) throw httpError(404, '리워드를 찾을 수 없습니다');
  console.log('reward update success: rewardId=' + rewardId);
  return mapRow(rows[0]);
}

async function updateRewardStatus(rewardId, status) {
  if (status !== 'ACTIVE' && status !== 'INACTIVE') {
    throw httpError(400, "status는 'ACTIVE' 또는 'INACTIVE'만 허용됩니다");
  }
  const { rows } = await pool.query(
    `UPDATE rewards SET status = $2 WHERE reward_id = $1 RETURNING ${SELECT_COLUMNS}`,
    [rewardId, status]
  );
  if (rows.length === 0) throw httpError(404, '리워드를 찾을 수 없습니다');
  console.log('reward status update success: rewardId=' + rewardId + ', status=' + status);
  return mapRow(rows[0]);
}

function canRedeem(balances, recipe) {
  const balanceMap = new Map(balances.map((b) => [b.ingredientType, b.balance]));
  return recipe.every((item) => (balanceMap.get(item.ingredientType) ?? 0) >= item.quantity);
}

async function listRewardsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM rewards WHERE status = 'ACTIVE' ORDER BY reward_id`
  );
  const rewards = mapRows(rows);
  const balances = await stampService.getBalances(userId);
  return rewards.map((r) => ({ ...r, canRedeem: canRedeem(balances, r.recipe) }));
}

module.exports = { createReward, updateReward, updateRewardStatus, canRedeem, listRewardsForUser };
