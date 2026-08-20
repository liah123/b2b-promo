const participationService = require('../services/participation.service');

async function join(req, res, next) {
  try {
    const participation = await participationService.join({
      missionId: req.body.missionId,
      userId: req.user.userId,
    });
    res.status(201).json(participation);
  } catch (err) { next(err); }
}

async function listMine(req, res, next) {
  try {
    const participations = await participationService.listMyParticipations(req.user.userId);
    res.status(200).json(participations);
  } catch (err) { next(err); }
}

async function complete(req, res, next) {
  try {
    const participation = await participationService.completeParticipation(
      Number(req.params.participationId),
      { userId: req.user.userId, role: req.user.role }
    );
    res.status(200).json(participation);
  } catch (err) { next(err); }
}

async function confirm(req, res, next) {
  try {
    const participation = await participationService.completeParticipation(
      Number(req.params.participationId),
      { userId: req.user.userId, role: req.user.role }
    );
    res.status(200).json(participation);
  } catch (err) { next(err); }
}

module.exports = { join, listMine, complete, confirm };
