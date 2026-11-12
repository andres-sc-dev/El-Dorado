// team_code (3 letras) de cada equipo de API-Football. Es la clave natural que usan MySQL
// (match.home_team_code) y PostgreSQL (team.team_code). Los 8 códigos de la demo se conservan
// (MIL, NAC, AME, JUN, CAL, SFE, TOL, MED) para no romper las apuestas existentes.
// Se reconoce por el nombre porque el campo `code` de la API a veces viene vacío o repetido.
const RULES = [
  [/millonarios/i, 'MIL'],
  // Internacional de Bogotá (antes La Equidad) va antes que Nacional: su nombre contiene "nacional".
  [/internacional|equidad/i, 'EQU'],
  [/atl[eé]tico nacional|^nacional$/i, 'NAC'],
  [/am[eé]rica/i, 'AME'],
  [/junior/i, 'JUN'],
  [/deportivo cali|^cali$/i, 'CAL'],
  [/santa fe/i, 'SFE'],
  [/tolima/i, 'TOL'],
  [/medell[ií]n/i, 'MED'],
  [/once caldas/i, 'ONC'],
  [/pasto/i, 'PAS'],
  [/bucaramanga/i, 'BUC'],
  [/envigado/i, 'ENV'],
  [/jaguares/i, 'JAG'],
  [/alianza/i, 'ALI'],
  [/[aá]guilas/i, 'AGU'],
  [/pereira/i, 'PER'],
  [/chic[oó]/i, 'CHI'],
  [/huila/i, 'HUI'],
  [/patriotas/i, 'PAT'],
  [/fortaleza/i, 'FOR'],
  [/uni[oó]n magdalena/i, 'UMA'],
  [/llaneros/i, 'LLA'],
  [/cucuta|c[uú]cuta/i, 'CUC'],
  [/quind[ií]o/i, 'QUI'],
  [/real cartagena/i, 'RCA'],
];

function strip(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
}

// Código de un equipo { id, name, code } de API-Football.
function teamCodeFor(team) {
  for (const [pattern, code] of RULES) if (pattern.test(team.name)) return code;
  const fromApi = strip(team.code);
  if (fromApi.length === 3) return fromApi;
  return strip(team.name).slice(0, 3).padEnd(3, 'X');
}


// Nombre para mostrar (con tildes; la API los trae sin ellas) y nombre corto (máximo 30).
const DISPLAY = {
  MIL: ['Millonarios FC', 'Millonarios'],
  NAC: ['Atlético Nacional', 'Nacional'],
  AME: ['América de Cali', 'América'],
  JUN: ['Junior FC', 'Junior'],
  CAL: ['Deportivo Cali', 'Cali'],
  SFE: ['Independiente Santa Fe', 'Santa Fe'],
  TOL: ['Deportes Tolima', 'Tolima'],
  MED: ['Independiente Medellín', 'Medellín'],
  ONC: ['Once Caldas', 'Once Caldas'],
  PAS: ['Deportivo Pasto', 'Pasto'],
  BUC: ['Atlético Bucaramanga', 'Bucaramanga'],
  ENV: ['Envigado FC', 'Envigado'],
  JAG: ['Jaguares de Córdoba', 'Jaguares'],
  ALI: ['Alianza FC', 'Alianza'],
  EQU: ['Internacional de Bogotá', 'Internacional'],
  AGU: ['Águilas Doradas', 'Águilas'],
  PER: ['Deportivo Pereira', 'Pereira'],
  CHI: ['Boyacá Chicó', 'Chicó'],
  PAT: ['Patriotas Boyacá', 'Patriotas'],
  FOR: ['Fortaleza CEIF', 'Fortaleza'],
};

function displayNames(team, code = teamCodeFor(team)) {
  const [name, short] = DISPLAY[code] || [team.name, team.name];
  return { name: name.slice(0, 150), shortName: short.slice(0, 30) };
}

module.exports = { teamCodeFor, displayNames };
