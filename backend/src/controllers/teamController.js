const crestService = require('../services/crestService');

// GET /api/teams/:teamCode/crest. Imagen con ETag y Cache-Control; 304 si el navegador ya la tiene.
async function getCrest(request, response, next) {
  try {
    const crest = await crestService.getCrest(request.params.teamCode);
    response.set({
      'Content-Type': crest.contentType,
      // El genérico se cachea menos: el escudo real puede aparecer más tarde.
      'Cache-Control': crest.source === 'generic' ? 'public, max-age=300' : 'public, max-age=86400',
      ETag: crest.etag,
      'X-Crest-Source': crest.source,
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.fresh) {
      response.status(304).end();
      return;
    }
    response.send(crest.body);
  } catch (error) {
    next(error);
  }
}

module.exports = { getCrest };
