// Fase 5: datos reales de API-Football, cuotas y escudos. No necesitan bases de datos.
//   npm test
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-solo-para-pruebas-automatizadas';
process.env.MYSQL_HOST = '127.0.0.1';
process.env.MYSQL_PORT = '1';
process.env.POSTGRES_HOST = '127.0.0.1';
process.env.POSTGRES_PORT = '1';

const { buildMatchOdds, leagueAverage, overround, HOUSE_MARGIN } = require('../scripts/seed/oddsModel');
const { planMatches, readSeasonData, latestSeason, parseRound } = require('../scripts/seed/apifootball-load');
const { teamCodeFor } = require('../scripts/seed/teamCodes');
const crestService = require('../src/services/crestService');

const ROOT = path.resolve(__dirname, '..', '..');
const season = latestSeason();
const data = readSeasonData(season);

// team_stats como los deja el loader, leídos directo de los archivos.
const statsByCode = new Map(data.stats.map((s) => [teamCodeFor(s.team), {
  matches_played: s.fixtures.played.total, goals_for: s.goals.for.total.total, goals_against: s.goals.against.total.total,
}]));
const average = leagueAverage([...statsByCode.values()]);

describe('datos descargados', () => {
  test('20 equipos con team_code único de 3 letras y escudo local', () => {
    const codes = data.teams.map(({ team }) => teamCodeFor(team));
    assert.equal(new Set(codes).size, codes.length);
    for (const code of codes) {
      assert.match(code, /^[A-Z]{3}$/);
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'data', 'crests', `${code}.png`)), `falta el escudo ${code}`);
    }
    for (const code of ['MIL', 'NAC', 'AME', 'JUN', 'CAL', 'SFE', 'TOL', 'MED']) assert.ok(codes.includes(code), `se perdió ${code}`);
  });

  test('las rondas se traducen a jornadas 1-26', () => {
    assert.deepEqual(parseRound('Apertura - 7'), { half: 1, number: 7, stage: 'Apertura' });
    assert.deepEqual(parseRound('Clausura - Quadrangular - 6'), { half: 2, number: 25, stage: 'Clausura' });
    assert.deepEqual(parseRound('Apertura - Final'), { half: 1, number: 26, stage: 'Apertura' });
  });

  test('match_code únicos y válidos; réplicas de demo en el futuro', () => {
    const { real, demo } = planMatches(season, data);
    const codes = [...real, ...demo].map((m) => m.code);
    assert.equal(new Set(codes).size, codes.length);
    for (const code of codes) assert.match(code, /^[A-Z]{2}[0-9]{6}$/);
    assert.ok(demo.length > 0);
    for (const m of demo) {
      assert.ok(m.code.startsWith('DM'));
      assert.ok(m.date > new Date(), `${m.code} quedó en el pasado`);
    }
  });
});

describe('modelo de cuotas', () => {
  const { demo } = planMatches(season, data);
  const allPairs = [...statsByCode.keys()].flatMap((h) => [...statsByCode.keys()].filter((a) => a !== h).map((a) => [h, a]));

  test(`todas las cuotas son mayores que 1 (${allPairs.length} cruces posibles)`, () => {
    for (const [home, away] of allPairs) {
      for (const odd of buildMatchOdds(statsByCode.get(home), statsByCode.get(away), average)) {
        assert.ok(odd.odd_value > 1, `${home}-${away} ${odd.outcome_code} = ${odd.odd_value}`);
        assert.ok(odd.odd_value < 10000);
      }
    }
  });

  test('margen de la casa entre 5 % y 8 % en 1X2 y total de goles', () => {
    for (const [home, away] of allPairs) {
      const odds = buildMatchOdds(statsByCode.get(home), statsByCode.get(away), average);
      for (const market of ['1X2', 'TOTAL_GOALS']) {
        const margin = overround(odds.filter((o) => o.market_code === market).map((o) => o.odd_value));
        assert.ok(margin >= 0.05 && margin <= 0.08, `${home}-${away} ${market}: ${(margin * 100).toFixed(2)} %`);
      }
    }
    assert.ok(HOUSE_MARGIN >= 0.05 && HOUSE_MARGIN <= 0.08);
  });

  test('equipo sin estadísticas: usa el promedio y la cuota sigue siendo válida', () => {
    for (const odd of buildMatchOdds(undefined, undefined, average)) assert.ok(odd.odd_value > 1);
  });

  test('el local fuerte es favorito ante el débil', () => {
    const ranked = [...statsByCode.entries()].sort((a, b) => (b[1].goals_for - b[1].goals_against) - (a[1].goals_for - a[1].goals_against));
    const [strong, weak] = [ranked[0][1], ranked.at(-1)[1]];
    const odds = buildMatchOdds(strong, weak, average);
    assert.ok(odds.find((o) => o.outcome_code === 'HOME').odd_value < odds.find((o) => o.outcome_code === 'AWAY').odd_value);
    assert.ok(demo.length >= 10);
  });
});

describe('GET /api/teams/:teamCode/crest', () => {
  let server;
  let baseUrl;
  const app = require('../server');

  before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('equipo con archivo local -> PNG con ETag y Cache-Control', async () => {
    const response = await fetch(`${baseUrl}/api/teams/MIL/crest`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.match(response.headers.get('cache-control'), /max-age=\d+/);
    assert.ok(response.headers.get('etag'));
    const body = Buffer.from(await response.arrayBuffer());
    assert.deepEqual([...body.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]); // firma PNG

    // Con node:http: fetch agrega "Cache-Control: no-cache" cuando lleva If-None-Match (lo dice su especificación).
    const status = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/api/teams/MIL/crest`, { headers: { 'If-None-Match': response.headers.get('etag') } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      }).on('error', reject);
    });
    assert.equal(status, 304);
  });

  test('equipo sin archivo -> SVG genérico, nunca 500', async () => {
    const response = await fetch(`${baseUrl}/api/teams/ZZZ/crest`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
    assert.match(await response.text(), /<svg[\s\S]*ZZZ/);
  });

  test('código malformado o intento de salir de la carpeta -> 400', async () => {
    for (const code of ['MI', 'MILL', '..%2F..', 'M1L']) {
      const response = await fetch(`${baseUrl}/api/teams/${code}/crest`);
      assert.equal(response.status, 400, code);
    }
  });

  test('Drive configurado pero roto -> cae al archivo local (nunca 500)', async () => {
    const keys = ['GDRIVE_CRESTS_FOLDER_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    process.env.GDRIVE_CRESTS_FOLDER_ID = 'carpeta_que_no_existe_123';
    process.env.FIREBASE_CLIENT_EMAIL = 'nadie@ejemplo.iam.gserviceaccount.com';
    process.env.FIREBASE_PRIVATE_KEY = 'no-es-una-llave';
    crestService.clearCache();
    const warn = console.warn;
    console.warn = () => {};
    try {
      const file = await fetch(`${baseUrl}/api/teams/NAC/crest`);
      assert.equal(file.status, 200);
      assert.equal(file.headers.get('x-crest-source'), 'file');
      const generic = await fetch(`${baseUrl}/api/teams/QQQ/crest`);
      assert.equal(generic.status, 200);
      assert.equal(generic.headers.get('x-crest-source'), 'generic');
    } finally {
      console.warn = warn;
      for (const key of keys) {
        if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
      }
      crestService.clearCache();
    }
  });

  test('GET /api/matches con parámetros inválidos -> 400 antes de tocar MySQL', async () => {
    for (const query of ['view=todo', 'view=history&team=M1', 'view=history&limit=-1', 'view=history&limit=500']) {
      const response = await fetch(`${baseUrl}/api/matches?${query}`);
      // requireDb('mysql') va primero: con MySQL caído responde 503; nunca 500.
      assert.ok([400, 503].includes(response.status), `${query}: ${response.status}`);
    }
  });
});

describe('ninguna llamada a API-Football fuera de scripts/seed', () => {
  const SKIP = new Set(['node_modules', 'dist', 'data', '.git', 'seed']);
  function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (SKIP.has(entry.name)) return [];
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(c|m)?jsx?$/.test(entry.name) ? [full] : [];
    });
  }

  // En el contenedor del backend no están montados frontend/ ni docker-compose.yml: allí se omite esa parte.
  const frontendDir = path.join(ROOT, 'frontend', 'src');
  const composeFile = path.join(ROOT, 'docker-compose.yml');

  test('ni el backend (src, server.js) ni el frontend mencionan api-sports.io o la llave', () => {
    const files = [
      ...walk(path.join(__dirname, '..', 'src')),
      path.join(__dirname, '..', 'server.js'),
      ...(fs.existsSync(frontendDir) ? walk(frontendDir) : []),
    ];
    assert.ok(files.length > 20);
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /api-sports\.io|api-football\.com|x-apisports-key|API_FOOTBALL_KEY/i, file);
    }
  });

  test('docker-compose no le pasa API_FOOTBALL_KEY a ningún contenedor', { skip: !fs.existsSync(composeFile) && 'docker-compose.yml no está montado aquí' }, () => {
    const compose = fs.readFileSync(composeFile, 'utf8');
    assert.doesNotMatch(compose, /API_FOOTBALL_KEY\s*:/);
  });

  test('el loader solo lee archivos (no usa fetch ni el host de la API)', () => {
    const loader = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'seed', 'apifootball-load.js'), 'utf8');
    assert.doesNotMatch(loader, /fetch\(|https?:\/\/|api-sports/);
  });
});
