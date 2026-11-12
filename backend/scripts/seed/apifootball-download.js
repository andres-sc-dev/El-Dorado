// Descarga UNA sola vez los datos de la Liga BetPlay desde API-Football y los guarda en archivos.
// Se ejecuta a mano, nunca desde la app:
//   node scripts/seed/apifootball-download.js [--season=2024] [--budget=70] [--with-players] [--no-crests]
// - La llave sale de API_FOOTBALL_KEY (.env de la raíz o backend/.env). Nunca se imprime.
// - Cada respuesta cruda queda en backend/data/apifootball/<season>/*.json. Si el archivo ya
//   existe, NO se vuelve a pedir: el script se puede reanudar otro día sin gastar cuota.
// - Lleva un presupuesto diario propio (data/apifootball/_meta/budget.json) y además respeta los
//   headers x-ratelimit-* de la API (plan gratuito: 100 por día y 10 por minuto).
// - Los escudos (team.logo) se guardan en backend/data/crests/<team_code>.png.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const BACKEND_DIR = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.resolve(BACKEND_DIR, '..', '.env'), quiet: true });
dotenv.config({ path: path.resolve(BACKEND_DIR, '.env'), quiet: true });

const { teamCodeFor } = require('./teamCodes');

const API_HOST = 'https://v3.football.api-sports.io';
const DATA_DIR = path.join(BACKEND_DIR, 'data', 'apifootball');
const META_DIR = path.join(DATA_DIR, '_meta');
const CRESTS_DIR = path.join(BACKEND_DIR, 'data', 'crests');
const BUDGET_FILE = path.join(META_DIR, 'budget.json');
const PAUSE_MS = 7000;          // 10 por minuto => una cada 6 s; 7 s deja margen.
const DAILY_SAFETY_MARGIN = 3;  // Nunca se gasta la cuota diaria hasta el último request.

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  return [key, value ?? true];
}));
const requestedSeason = Number(args.season || 2024);
const budgetToday = Number(args.budget || 70);

const apiKey = (process.env.API_FOOTBALL_KEY || '').trim();
if (!apiKey) {
  console.error('Falta API_FOOTBALL_KEY en el .env');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const today = () => new Date().toISOString().slice(0, 10);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

// ---------- Presupuesto ----------
const budget = fs.existsSync(BUDGET_FILE) ? readJson(BUDGET_FILE) : { days: {} };
const usage = () => budget.days[today()] || { used: 0, log: [] };
let lastHeaders = { dailyLimit: null, dailyRemaining: null, minuteLimit: null, minuteRemaining: null };
let lastCallAt = 0;

function canSpend() {
  if (usage().used >= budgetToday) return false;
  if (lastHeaders.dailyRemaining !== null && lastHeaders.dailyRemaining <= DAILY_SAFETY_MARGIN) return false;
  return true;
}

function recordCall(endpoint, status) {
  const day = usage();
  day.used += 1;
  day.log.push({ at: new Date().toISOString(), endpoint, status, daily_remaining: lastHeaders.dailyRemaining });
  budget.days[today()] = day;
  writeJson(BUDGET_FILE, budget);
}

function readRateHeaders(response) {
  const num = (name) => {
    const value = response.headers.get(name);
    return value === null ? null : Number(value);
  };
  lastHeaders = {
    dailyLimit: num('x-ratelimit-requests-limit'),
    dailyRemaining: num('x-ratelimit-requests-remaining'),
    minuteLimit: num('x-ratelimit-limit'),
    minuteRemaining: num('x-ratelimit-remaining'),
  };
}

// Una llamada a la API. Sin reintentos agresivos: si responde 429 espera un minuto y prueba una sola vez más.
async function apiGet(endpoint, { countsAgainstBudget = true } = {}) {
  if (countsAgainstBudget && !canSpend()) return { skipped: true };
  const wait = lastCallAt + PAUSE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  if (lastHeaders.minuteRemaining !== null && lastHeaders.minuteRemaining <= 1) await sleep(61000);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    lastCallAt = Date.now();
    const response = await fetch(`${API_HOST}${endpoint}`, { headers: { 'x-apisports-key': apiKey } });
    readRateHeaders(response);
    if (countsAgainstBudget) recordCall(endpoint, response.status);
    if (response.status === 429 && attempt === 1) {
      console.log('  429 (límite por minuto): espero 65 s y pruebo una vez más');
      await sleep(65000);
      continue;
    }
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  }
  return { status: 429, body: {} };
}

const hasErrors = (body) => body && body.errors && (Array.isArray(body.errors) ? body.errors.length > 0 : Object.keys(body.errors).length > 0);

// Pide un endpoint solo si su archivo no existe. Guarda la respuesta cruda (solo si no trae errores).
async function cached(file, endpoint) {
  if (fs.existsSync(file)) return { body: readJson(file), fromCache: true };
  const result = await apiGet(endpoint);
  if (result.skipped) return { skipped: true };
  if (result.status !== 200 || hasErrors(result.body)) {
    console.log(`  ${endpoint}: ${result.status} ${JSON.stringify(result.body.errors || {})}`);
    return { body: result.body, error: true };
  }
  writeJson(file, result.body);
  console.log(`  ✔ ${endpoint} -> ${path.relative(BACKEND_DIR, file)} (${result.body.results ?? '?'} resultados)`);
  return { body: result.body };
}

// "Free plans do not have access to this season, try from 2022 to 2024." -> 2024
function maxSeasonFromPlanError(body) {
  const text = JSON.stringify(body?.errors || {});
  const match = text.match(/from (\d{4}) to (\d{4})/);
  return match ? Number(match[2]) : null;
}

async function main() {
  fs.mkdirSync(META_DIR, { recursive: true });

  // /status no cuenta en la cuota diaria (documentación de API-Football). Se guarda sin la cuenta personal.
  const status = await apiGet('/status', { countsAgainstBudget: false });
  const plan = status.body?.response?.subscription?.plan;
  const requests = status.body?.response?.requests;
  writeJson(path.join(META_DIR, `status-${today()}.json`), { subscription: status.body?.response?.subscription, requests });
  console.log(`Plan: ${plan ?? 'desconocido'} · peticiones hoy según la API: ${requests?.current ?? '?'} de ${requests?.limit_day ?? '?'}`);

  // Liga: Primera A de Colombia (Liga BetPlay).
  const leagues = await cached(path.join(META_DIR, 'leagues-colombia.json'), '/leagues?country=Colombia');
  if (!leagues.body?.response) throw new Error('No se pudo leer /leagues?country=Colombia');
  const entry = leagues.body.response.find((item) => item.league.type === 'League' && /primera a/i.test(item.league.name));
  if (!entry) throw new Error('No se encontró la Primera A de Colombia en /leagues');
  const leagueId = entry.league.id;
  const listedSeasons = entry.seasons.map((s) => s.year).sort();
  console.log(`Liga: ${entry.league.name} (id ${leagueId}) · temporadas listadas: ${listedSeasons.join(', ')}`);

  // Temporada: la pedida si el plan la permite; si no, la más reciente que el plan permita.
  let season = requestedSeason;
  let teams;
  for (let tries = 0; tries < 3; tries += 1) {
    const seasonDir = path.join(DATA_DIR, String(season));
    teams = await cached(path.join(seasonDir, 'teams.json'), `/teams?league=${leagueId}&season=${season}`);
    if (teams.skipped) throw new Error('Presupuesto agotado antes de bajar los equipos');
    if (!teams.error && teams.body.results > 0) break;
    writeJson(path.join(META_DIR, `season-${season}-error.json`), { endpoint: `/teams?league=${leagueId}&season=${season}`, errors: teams.body?.errors, results: teams.body?.results });
    const allowed = maxSeasonFromPlanError(teams.body);
    if (!allowed || allowed === season) throw new Error(`La temporada ${season} no es accesible y no hay alternativa: usar el plan B`);
    console.log(`La temporada ${season} no está en el plan; uso ${allowed}`);
    season = allowed;
  }
  const seasonDir = path.join(DATA_DIR, String(season));
  writeJson(path.join(seasonDir, 'league.json'), { league: entry.league, country: entry.country, season: entry.seasons.find((s) => s.year === season) || { year: season } });

  // Fixtures de toda la temporada (1 petición).
  await cached(path.join(seasonDir, 'fixtures.json'), `/fixtures?league=${leagueId}&season=${season}`);

  const teamList = teams.body.response;
  // Estadísticas por equipo (~20) y luego plantillas (~20): primero todas las de mayor prioridad.
  for (const { team } of teamList) {
    const r = await cached(path.join(seasonDir, 'team-stats', `${team.id}.json`), `/teams/statistics?league=${leagueId}&season=${season}&team=${team.id}`);
    if (r.skipped) break;
  }
  for (const { team } of teamList) {
    const r = await cached(path.join(seasonDir, 'squads', `${team.id}.json`), `/players/squads?team=${team.id}`);
    if (r.skipped) break;
  }

  // Jugadores con estadísticas por página: solo si se pide y si sobra presupuesto.
  if (args['with-players']) {
    for (let page = 1; page <= 40; page += 1) {
      const r = await cached(path.join(seasonDir, 'players', `page-${page}.json`), `/players?league=${leagueId}&season=${season}&page=${page}`);
      if (r.skipped || r.error) break;
      if (page >= (r.body.paging?.total || 1)) break;
    }
  }

  // Escudos desde el CDN media.api-sports.io. Se mide con /status antes y después si cuentan en la cuota.
  if (!args['no-crests']) {
    const before = (await apiGet('/status', { countsAgainstBudget: false })).body?.response?.requests?.current;
    let downloaded = 0;
    for (const { team } of teamList) {
      const code = teamCodeFor(team);
      const file = path.join(CRESTS_DIR, `${code}.png`);
      if (fs.existsSync(file) || !team.logo) continue;
      if (!team.logo.startsWith('https://media.api-sports.io/')) continue;
      await sleep(500);
      const response = await fetch(team.logo);
      if (!response.ok) { console.log(`  escudo ${code}: ${response.status}`); continue; }
      fs.mkdirSync(CRESTS_DIR, { recursive: true });
      fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
      downloaded += 1;
    }
    const after = (await apiGet('/status', { countsAgainstBudget: false })).body?.response?.requests?.current;
    console.log(`Escudos descargados: ${downloaded} · contador de la API antes ${before}, después ${after}`
      + (before === after ? ' (los escudos NO cuentan en la cuota)' : ' (los escudos SÍ cuentan)'));
    writeJson(path.join(META_DIR, 'crests-quota-check.json'), { date: today(), downloaded, before, after });
  }

  console.log(`\nTemporada usada: ${season}`);
  console.log(`Peticiones gastadas hoy por este script: ${usage().used} de ${budgetToday} (presupuesto propio)`);
  console.log(`Cuota diaria según la API: quedan ${lastHeaders.dailyRemaining ?? '?'} de ${lastHeaders.dailyLimit ?? '?'}`);
}

main().catch((error) => {
  console.error(`apifootball-download falló: ${error.message}`);
  process.exitCode = 1;
});
