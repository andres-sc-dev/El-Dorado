const publicResourceRepository = require('../repositories/publicResourceRepository');
const { parsePositiveInt } = require('../utils/validation');
const { notFound } = require('../utils/httpError');

// Lecturas públicas genéricas (partidos, cuotas, equipos, mercados...).
function createResourceController(name) {
  async function list(request, response, next) {
    try {
      response.json(await publicResourceRepository.list(name));
    } catch (error) {
      next(error);
    }
  }

  async function getById(request, response, next) {
    try {
      const record = await publicResourceRepository.getById(name, parsePositiveInt(request.params.id));
      if (!record) throw notFound('Registro no encontrado');
      response.json(record);
    } catch (error) {
      next(error);
    }
  }

  return { list, getById };
}

module.exports = { createResourceController };
