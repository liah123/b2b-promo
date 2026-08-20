const missionService = require('../services/mission.service');

async function create(req, res, next) {
  try {
    const mission = await missionService.createMission({ ...req.body, createdBy: req.user.userId });
    res.status(201).json(mission);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const missions = req.user.role === 'ADMIN'
      ? await missionService.listMissions()
      : await missionService.listMissionsForCustomer(req.user.userId);
    res.status(200).json(missions);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const mission = await missionService.getMissionForUser(req.params.missionId, req.user.userId);
    res.status(200).json(mission);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const mission = await missionService.updateMission(req.params.missionId, req.body);
    res.status(200).json(mission);
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const mission = await missionService.updateMissionStatus(req.params.missionId, req.body.status);
    res.status(200).json(mission);
  } catch (err) { next(err); }
}

module.exports = { create, list, getById, update, updateStatus };
