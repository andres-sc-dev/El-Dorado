// Reglas de liquidación por mercado (sin bases de datos).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSelection } = require('../src/services/settlementService');

const listed = ['0-0', '1-0', '0-1', '1-1', '2-0', '0-2', '2-1', '1-2', '2-2'];
const at = (homeGoals, awayGoals) => ({ homeGoals, awayGoals });
const run = (marketCode, outcomeCode, line, score) => evaluateSelection({ marketCode, outcomeCode, line }, score, listed);

const cases = [
  ['1X2', 'HOME', 0, at(2, 1), 'WON'],
  ['1X2', 'DRAW', 0, at(2, 1), 'LOST'],
  ['1X2', 'DRAW', 0, at(1, 1), 'WON'],
  ['1X2', 'AWAY', 0, at(0, 3), 'WON'],
  ['TOTAL_GOALS', 'OVER', 2.5, at(2, 1), 'WON'],
  ['TOTAL_GOALS', 'UNDER', 2.5, at(2, 1), 'LOST'],
  ['TOTAL_GOALS', 'UNDER', 2.5, at(1, 1), 'WON'],
  ['TOTAL_GOALS', 'OVER', 3, at(2, 1), 'REFUNDED'],
  ['BTTS', 'YES', 0, at(2, 1), 'WON'],
  ['BTTS', 'NO', 0, at(2, 0), 'WON'],
  ['BTTS', 'YES', 0, at(0, 0), 'LOST'],
  ['HANDICAP', 'HOME', -1, at(2, 1), 'REFUNDED'],
  ['HANDICAP', 'HOME', -1, at(3, 1), 'WON'],
  ['HANDICAP', 'AWAY', -1, at(3, 1), 'LOST'],
  ['HANDICAP', 'AWAY', -1.5, at(2, 1), 'WON'],
  ['HANDICAP', 'HOME', 0.5, at(1, 1), 'WON'],
  ['EXACT_SCORE', '2-1', 0, at(2, 1), 'WON'],
  ['EXACT_SCORE', '1-1', 0, at(2, 1), 'LOST'],
  ['EXACT_SCORE', 'OTHER', 0, at(4, 2), 'WON'],
  ['EXACT_SCORE', 'OTHER', 0, at(2, 1), 'LOST'],
];

for (const [market, outcome, line, score, expected] of cases) {
  test(`${market} ${outcome} ${line} con ${score.homeGoals}-${score.awayGoals} -> ${expected}`, () => {
    assert.equal(run(market, outcome, line, score), expected);
  });
}

test('un mercado sin regla lanza error (no se liquida a ciegas)', () => {
  assert.throws(() => run('CORNERS', 'OVER', 9.5, at(1, 0)));
});
