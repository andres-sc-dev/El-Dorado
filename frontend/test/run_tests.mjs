import assert from 'assert';
import { loginUser, registerUser } from '../src/services/authService.js';
import { getMatchDetails } from '../src/services/matchService.js';
import { placeBet, getUserBets } from '../src/services/betService.js';
import { users } from '../src/data/users.js';

async function run() {
  console.log('TEST START');

  // 1) Login existing user
  try {
    const user = await loginUser('andres@example.com', '123456');
    console.log('PASS: loginUser returned', user.id);
  } catch (e) {
    console.error('FAIL: loginUser should succeed for seed user', e.message);
    process.exitCode = 2;
    return;
  }

  // 2) getMatchDetails
  const matches = await getMatchDetails();
  if (!Array.isArray(matches) || matches.length === 0) {
    console.error('FAIL: getMatchDetails returned no matches');
    process.exitCode = 3;
    return;
  }
  console.log('PASS: getMatchDetails returned', matches.length, 'matches');

  // 3) place a bet within balance
  const userBefore = users.find((u) => u.email === 'andres@example.com');
  const startingBalance = userBefore.balance;

  const match = matches[0];
  const odd = match.odds && match.odds[0];
  if (!odd) {
    console.error('FAIL: no odds for first match');
    process.exitCode = 4;
    return;
  }

  const stake = Math.min(10000, Math.max(1000, Math.floor(startingBalance / 10)));

  const betPayload = {
    userId: userBefore.id,
    stake,
    totalOdds: Number(odd.value),
    potentialPayout: stake * Number(odd.value),
    selections: [
      {
        id: `test-bs-${Date.now()}`,
        betId: 'temp',
        matchId: match.id,
        oddId: odd.id,
        oddValueAtBetTime: odd.value,
        result: 'pending',
      },
    ],
  };

  try {
    const created = await placeBet(betPayload);
    console.log('PASS: placeBet created', created.id);
  } catch (e) {
    console.error('FAIL: placeBet failed unexpectedly', e.message);
    process.exitCode = 5;
    return;
  }

  // verify balance decreased
  const userAfter = users.find((u) => u.id === userBefore.id);
  if (userAfter.balance !== startingBalance - stake) {
    console.error('FAIL: user balance did not decrease as expected', startingBalance, userAfter.balance);
    process.exitCode = 6;
    return;
  }
  console.log('PASS: user balance decreased by stake');

  // 4) place bet with insufficient funds
  try {
    const bigBet = { ...betPayload, stake: userAfter.balance + 1000000 };
    await placeBet(bigBet);
    console.error('FAIL: placeBet should have failed due to insufficient funds but succeeded');
    process.exitCode = 7;
    return;
  } catch (e) {
    console.log('PASS: placeBet rejected insufficient funds');
  }

  // 5) getUserBets
  const bets = await getUserBets(userAfter.id);
  if (!Array.isArray(bets)) {
    console.error('FAIL: getUserBets did not return array');
    process.exitCode = 8;
    return;
  }
  console.log('PASS: getUserBets returned', bets.length, 'bets for user');

  // 6) register existing user should fail
  try {
    await registerUser({ fullName: 'Foo', email: 'andres@example.com', username: 'andres10', password: 'x' });
    console.error('FAIL: registerUser should fail for duplicate email/username but succeeded');
    process.exitCode = 9;
    return;
  } catch (e) {
    console.log('PASS: registerUser rejected duplicate user');
  }

  console.log('ALL TESTS PASSED');
}

run().catch((err) => {
  console.error('ERROR during tests', err);
  process.exitCode = 20;
});
