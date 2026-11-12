// Modelo simple de cuotas para los partidos de demo (1X2 y total de goles 2.5).
// 1) Fuerza de cada equipo desde team_stats: ataque = goles a favor por partido / promedio de la liga,
//    defensa = goles en contra por partido / promedio. Se suaviza hacia el promedio (como si cada
//    equipo tuviera SMOOTHING_MATCHES partidos "promedio" extra) para evitar cuotas extremas.
// 2) Goles esperados (Poisson): local = promedio × ataque local × defensa visitante × ventaja de local;
//    visitante = promedio × ataque visitante × defensa local / ventaja de local.
// 3) Probabilidades de 0 a 10 goles por lado -> P(local), P(empate), P(visitante), P(más de 2.5).
// 4) Cuota = 1 / (probabilidad × (1 + margen)), redondeada hacia abajo a 2 decimales (favorece a la casa)
//    y nunca menor que MIN_ODD. El margen de la casa queda entre 5 % y 8 %.
const HOUSE_MARGIN = 0.06;
const HOME_ADVANTAGE = 1.12;
const SMOOTHING_MATCHES = 5;
const MAX_GOALS = 10;
const MIN_ODD = 1.01;

function poisson(k, lambda) {
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return (lambda ** k) * Math.exp(-lambda) / factorial;
}

// Promedio de goles por equipo y por partido en la liga.
function leagueAverage(statsList) {
  const goals = statsList.reduce((sum, s) => sum + s.goals_for, 0);
  const played = statsList.reduce((sum, s) => sum + s.matches_played, 0);
  return played > 0 ? goals / played : 1.2;
}

function strength(stats, average) {
  const mp = (stats?.matches_played || 0) + SMOOTHING_MATCHES;
  const gf = (stats?.goals_for || 0) + SMOOTHING_MATCHES * average;
  const ga = (stats?.goals_against || 0) + SMOOTHING_MATCHES * average;
  return { attack: gf / mp / average, defense: ga / mp / average };
}

function expectedGoals(homeStats, awayStats, average) {
  const home = strength(homeStats, average);
  const away = strength(awayStats, average);
  return {
    home: average * home.attack * away.defense * HOME_ADVANTAGE,
    away: average * away.attack * home.defense / HOME_ADVANTAGE,
  };
}

function probabilities({ home: lh, away: la }) {
  const p = { home: 0, draw: 0, away: 0, under25: 0 };
  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      const value = poisson(h, lh) * poisson(a, la);
      if (h > a) p.home += value; else if (h === a) p.draw += value; else p.away += value;
      if (h + a <= 2) p.under25 += value;
    }
  }
  // Se normaliza para repartir lo que queda fuera de 0..10 goles.
  const total = p.home + p.draw + p.away;
  return {
    home: p.home / total, draw: p.draw / total, away: p.away / total,
    under25: p.under25 / total, over25: 1 - p.under25 / total,
  };
}

function price(probability, margin = HOUSE_MARGIN) {
  const odd = Math.floor((1 / (probability * (1 + margin))) * 100) / 100;
  return Math.max(MIN_ODD, odd);
}

// Margen real de un mercado: suma de 1/cuota menos 1.
function overround(odds) {
  return odds.reduce((sum, odd) => sum + 1 / odd, 0) - 1;
}

// Cuotas de un partido como filas { market_code, outcome_code, line, odd_value }.
function buildMatchOdds(homeStats, awayStats, average) {
  const p = probabilities(expectedGoals(homeStats, awayStats, average));
  return [
    { market_code: '1X2', outcome_code: 'HOME', line: 0, odd_value: price(p.home) },
    { market_code: '1X2', outcome_code: 'DRAW', line: 0, odd_value: price(p.draw) },
    { market_code: '1X2', outcome_code: 'AWAY', line: 0, odd_value: price(p.away) },
    { market_code: 'TOTAL_GOALS', outcome_code: 'OVER', line: 2.5, odd_value: price(p.over25) },
    { market_code: 'TOTAL_GOALS', outcome_code: 'UNDER', line: 2.5, odd_value: price(p.under25) },
  ];
}

module.exports = {
  HOUSE_MARGIN, leagueAverage, expectedGoals, probabilities, price, overround, buildMatchOdds,
};
