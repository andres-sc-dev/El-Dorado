// Resultado de cada selección a partir del marcador final.
// Devuelve WON, LOST o REFUNDED (empate exacto contra la línea: se devuelve el monto).
// Las reglas siguen database/mongo/mercados.json y game_rule (tiempo reglamentario).

function evaluateSelection({ marketCode, outcomeCode, line }, { homeGoals, awayGoals }, listedScores = []) {
  const total = homeGoals + awayGoals;
  const lineValue = Number(line);
  const wonIf = (condition) => (condition ? 'WON' : 'LOST');

  switch (marketCode) {
    case '1X2': {
      const winner = homeGoals > awayGoals ? 'HOME' : homeGoals < awayGoals ? 'AWAY' : 'DRAW';
      return wonIf(outcomeCode === winner);
    }
    case 'TOTAL_GOALS': {
      if (total === lineValue) return 'REFUNDED';
      return wonIf(outcomeCode === (total > lineValue ? 'OVER' : 'UNDER'));
    }
    case 'BTTS': {
      const both = homeGoals > 0 && awayGoals > 0;
      return wonIf(outcomeCode === (both ? 'YES' : 'NO'));
    }
    case 'HANDICAP': {
      // La línea se suma siempre a los goles del local.
      const difference = homeGoals + lineValue - awayGoals;
      if (difference === 0) return 'REFUNDED';
      return wonIf(outcomeCode === (difference > 0 ? 'HOME' : 'AWAY'));
    }
    case 'EXACT_SCORE': {
      const score = `${homeGoals}-${awayGoals}`;
      // OTHER gana cuando el marcador no está entre los resultados listados en MongoDB.
      if (outcomeCode === 'OTHER') return wonIf(!listedScores.includes(score));
      return wonIf(outcomeCode === score);
    }
    default:
      throw new Error(`Mercado sin regla de liquidación: ${marketCode}`);
  }
}

// Arma el jsonb que recibe fn_liquidar_partido.
function buildResultado(selections, score, listedScores) {
  return {
    home_goals: score.homeGoals,
    away_goals: score.awayGoals,
    outcomes: selections.map((selection) => ({
      market_code: selection.market_code,
      outcome_code: selection.outcome_code,
      line: Number(selection.line),
      result: evaluateSelection({
        marketCode: selection.market_code,
        outcomeCode: selection.outcome_code,
        line: selection.line,
      }, score, listedScores),
    })),
  };
}

module.exports = { evaluateSelection, buildResultado };
