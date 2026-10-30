import { useEffect, useState } from 'react';
import BetSlip from '../components/betting/BetSlip';
import MatchCard from '../components/betting/MatchCard';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { useBetSlip } from '../context/BetSlipContext';
import { getMatchDetails } from '../services/matchService';

function MatchesPage() {
  const { addSelection } = useBetSlip();
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    getMatchDetails().then(setMatches);
  }, []);

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-brand-gold">Primera A</p>
            <h1 className="text-3xl font-black text-white">Partidos de Colombia</h1>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onSelectOdd={(odd) => addSelection({ ...odd, oddId: odd.id, label: odd.label, value: odd.value, matchLabel: `${match.homeTeam?.shortName} vs ${match.awayTeam?.shortName}` })}
              />
            ))}
          </div>

          <div className="xl:sticky xl:top-24 xl:self-start">
            <BetSlip />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default MatchesPage;
