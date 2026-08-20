const pool = require('../db/pool');
const { mapRow, mapRows } = require('./mapRow');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function calcMissionStatus(startAt, endAt, now = new Date()) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const n = new Date(now);
  if (n < start) return 'PENDING';
  if (n > end) return 'ENDED';
  return 'ACTIVE';
}

function assertValidPeriodAndCount(startAt, endAt, stampCount) {
  if (new Date(endAt) <= new Date(startAt)) {
    throw httpError(400, '종료일은 시작일 이후여야 합니다');
  }
  if (stampCount <= 0) {
    throw httpError(400, '스탬프 개수는 1개 이상이어야 합니다');
  }
}

const SELECT_COLUMNS = `mission_id, title, description, start_at, end_at, completion_condition, ingredient_type, stamp_count, status, created_by`;

async function createMission({ title, description, startAt, endAt, completionCondition, ingredientType, stampCount, createdBy }) {
  if (!title || !startAt || !endAt || !ingredientType || stampCount == null) {
    throw httpError(400, 'title, startAt, endAt, ingredientType, stampCount는 필수입니다');
  }
  assertValidPeriodAndCount(startAt, endAt, stampCount);

  const status = calcMissionStatus(startAt, endAt);

  const { rows } = await pool.query(
    `INSERT INTO missions (title, description, start_at, end_at, completion_condition, ingredient_type, stamp_count, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${SELECT_COLUMNS}`,
    [title, description ?? null, startAt, endAt, completionCondition ?? null, ingredientType, stampCount, status, createdBy]
  );
  console.log('mission create success: missionId=' + rows[0].mission_id);
  return mapRow(rows[0]);
}

async function updateMission(missionId, patch) {
  const allowed = ['title', 'description', 'startAt', 'endAt', 'completionCondition', 'ingredientType', 'stampCount'];
  const fields = Object.keys(patch).filter((k) => allowed.includes(k) && patch[k] !== undefined);
  if (fields.length === 0) {
    throw httpError(400, '수정할 필드가 없습니다');
  }

  const current = await pool.query(`SELECT start_at, end_at, stamp_count FROM missions WHERE mission_id = $1`, [missionId]);
  if (current.rows.length === 0) throw httpError(404, '미션을 찾을 수 없습니다');

  const merged = {
    startAt: patch.startAt ?? current.rows[0].start_at,
    endAt: patch.endAt ?? current.rows[0].end_at,
    stampCount: patch.stampCount ?? current.rows[0].stamp_count,
  };
  assertValidPeriodAndCount(merged.startAt, merged.endAt, merged.stampCount);

  const nextStatus = (patch.startAt || patch.endAt) ? calcMissionStatus(merged.startAt, merged.endAt) : undefined;

  const columnMap = {
    title: 'title', description: 'description', startAt: 'start_at', endAt: 'end_at',
    completionCondition: 'completion_condition', ingredientType: 'ingredient_type', stampCount: 'stamp_count',
  };
  const setClauses = fields.map((f, i) => `${columnMap[f]} = $${i + 1}`);
  const values = fields.map((f) => patch[f]);
  if (nextStatus) {
    setClauses.push(`status = $${values.length + 1}`);
    values.push(nextStatus);
  }
  values.push(missionId);

  const { rows } = await pool.query(
    `UPDATE missions SET ${setClauses.join(', ')} WHERE mission_id = $${values.length} RETURNING ${SELECT_COLUMNS}`,
    values
  );
  console.log('mission update success: missionId=' + missionId);
  return mapRow(rows[0]);
}

async function updateMissionStatus(missionId, status) {
  if (status !== 'ENDED') {
    throw httpError(400, "status는 'ENDED'만 허용됩니다 (수동 종료 전용)");
  }
  const { rows } = await pool.query(
    `UPDATE missions SET status = 'ENDED' WHERE mission_id = $1 RETURNING ${SELECT_COLUMNS}`,
    [missionId]
  );
  if (rows.length === 0) throw httpError(404, '미션을 찾을 수 없습니다');
  console.log('mission manual end success: missionId=' + missionId);
  return mapRow(rows[0]);
}

async function listMissions() {
  const { rows } = await pool.query(`SELECT ${SELECT_COLUMNS} FROM missions ORDER BY mission_id DESC`);
  return mapRows(rows);
}

const M_SELECT_COLUMNS = SELECT_COLUMNS.split(', ').map((c) => `m.${c}`).join(', ');

async function listMissionsForCustomer(userId) {
  const { rows } = await pool.query(
    `SELECT ${M_SELECT_COLUMNS}, mp.status AS participation_status
     FROM missions m
     LEFT JOIN mission_participations mp ON mp.mission_id = m.mission_id AND mp.user_id = $1
     WHERE m.status IN ('PENDING', 'ACTIVE')
     ORDER BY m.mission_id DESC`,
    [userId]
  );
  return mapRows(rows);
}

async function getMissionForUser(missionId, userId) {
  const { rows } = await pool.query(
    `SELECT ${M_SELECT_COLUMNS}, mp.status AS participation_status
     FROM missions m
     LEFT JOIN mission_participations mp ON mp.mission_id = m.mission_id AND mp.user_id = $2
     WHERE m.mission_id = $1`,
    [missionId, userId]
  );
  if (rows.length === 0) throw httpError(404, '미션을 찾을 수 없습니다');
  return mapRow(rows[0]);
}

module.exports = { calcMissionStatus, createMission, updateMission, updateMissionStatus, listMissions, listMissionsForCustomer, getMissionForUser };
