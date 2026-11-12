const adminService = require('../services/adminService');
const { getClientIp } = require('../utils/request');

async function listMatches(request, response, next) {
  try {
    response.json(await adminService.listMatches());
  } catch (error) {
    next(error);
  }
}

async function finishMatch(request, response, next) {
  try {
    response.json(await adminService.finishMatch(
      request.user,
      request.params.matchCode,
      request.body,
      getClientIp(request),
    ));
  } catch (error) {
    next(error);
  }
}

module.exports = { listMatches, finishMatch };
