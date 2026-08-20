const pool = require('../db/pool');
const { mapRow, mapRows } = require('./mapRow');

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function join({ missionId, userId }) {
  if (!missionId) throw httpError(400, 'missionId는 필수입니다');

  const missionRes = await pool.query('SELECT status FROM missions WHERE mission_id = $1', [missionId]);
  if (missionRes.rows.length === 0) throw httpError(404, '미션을 찾을 수 없습니다');
  if (missionRes.rows[0].status !== 'ACTIVE') {
    throw httpError(400, '참여 가능한(ACTIVE) 미션이 아닙니다');
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO mission_participations (mission_id, user_id, status)
       VALUES ($1, $2, 'JOINED')
       RETURNING participation_id, mission_id, user_id, status, joined_at, completed_at`,
      [missionId, userId]
    );
    console.log('participation join success: missionId=' + missionId + ', userId=' + userId);
    return mapRow(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, '이미 참여중이거나 완료한 미션입니다');
    }
    throw err;
  }
}

async function listMyParticipations(userId) {
  const { rows } = await pool.query(
    `SELECT p.participation_id, p.mission_id, p.user_id, p.status, p.joined_at, p.completed_at,
            m.title AS mission_title
     FROM mission_participations p
     JOIN missions m ON m.mission_id = p.mission_id
     WHERE p.user_id = $1
     ORDER BY p.participation_id DESC`,
    [userId]
  );
  return mapRows(rows);
}

async function completeParticipation(participationId, { userId, role }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT p.participation_id, p.mission_id, p.user_id, p.status, p.joined_at, p.completed_at,
              m.ingredient_type, m.stamp_count
       FROM mission_participations p
       JOIN missions m ON m.mission_id = p.mission_id
       WHERE p.participation_id = $1
       FOR UPDATE OF p`,
      [participationId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      throw httpError(404, '참여 내역을 찾을 수 없습니다');
    }

    const participation = rows[0];

    if (role !== 'ADMIN' && Number(participation.user_id) !== Number(userId)) {
      await client.query('ROLLBACK');
      throw httpError(403, '본인의 참여 내역만 완료 처리할 수 있습니다');
    }

    if (participation.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      throw httpError(409, '이미 완료 처리된 참여 내역입니다');
    }

    const { rows: updated } = await client.query(
      `UPDATE mission_participations
       SET status = 'COMPLETED', completed_at = now()
       WHERE participation_id = $1
       RETURNING participation_id, mission_id, user_id, status, joined_at, completed_at`,
      [participationId]
    );

    await client.query(
      `INSERT INTO stamp_transactions (user_id, ingredient_type, type, amount, reason, related_mission_id)
       VALUES ($1, $2, 'EARN', $3, '적립 확인', $4)`,
      [participation.user_id, participation.ingredient_type, participation.stamp_count, participation.mission_id]
    );

    await client.query('COMMIT');
    console.log('participation complete success: participationId=' + participationId + ', userId=' + participation.user_id);
    return mapRow(updated[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { join, listMyParticipations, completeParticipation };
