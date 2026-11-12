const paymentService = require('../services/payment.service');
const { getClientIp } = require('../utils/request');

function getConfig(request, response, next) {
  try {
    response.json(paymentService.getConfig());
  } catch (error) {
    next(error);
  }
}

async function prepare(request, response, next) {
  try {
    response.status(201).json(await paymentService.prepare(request.user, request.body, getClientIp(request)));
  } catch (error) {
    next(error);
  }
}

async function getStatus(request, response, next) {
  try {
    response.json(await paymentService.getStatus(
      request.user, request.params.reference, request.query.transaction_id, getClientIp(request),
    ));
  } catch (error) {
    next(error);
  }
}

// request.body es un Buffer: express.raw() en server.js, antes de express.json().
async function webhook(request, response, next) {
  try {
    response.status(200).json(await paymentService.handleWebhook(request.body, getClientIp(request)));
  } catch (error) {
    next(error);
  }
}

module.exports = { getConfig, prepare, getStatus, webhook };
