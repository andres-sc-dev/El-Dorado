// Límites de apuesta en COP, leídos de BET_MIN_COP y BET_MAX_COP.
// La API los valida antes de llamar a PostgreSQL; la tabla bet_limit y el CHECK
// ck_bet_stake_limits los vuelven a exigir dentro de la base.
function getBetLimits() {
  const min = Number(process.env.BET_MIN_COP || 1000);
  const max = Number(process.env.BET_MAX_COP || 500000);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
    throw new Error('BET_MIN_COP y BET_MAX_COP deben ser números con 0 < mínimo <= máximo');
  }
  return { min, max, currency: 'COP' };
}

module.exports = { getBetLimits };
