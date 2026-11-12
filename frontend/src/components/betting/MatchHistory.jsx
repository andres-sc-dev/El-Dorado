import { useState } from 'react';
import { getMatchHistory } from '../../services/matchService';
import { formatDateTime } from '../../utils/format';
import Button from '../ui/Button';
import TeamShield from '../ui/TeamShield';

const PAGE_SIZE = 20;

// Resultados reales de la Liga BetPlay (API-Football, guardados en la base). Se cargan solo al pedirlos.
function MatchHistory() {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [opened, setOpened] = useState(false);

  const loadMore = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMatchHistory({ limit: PAGE_SIZE, offset: matches.length });
      setMatches((current) => [...current, ...data.matches]);
      setHasMore(data.matches.length === PAGE_SIZE);
      setOpened(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="pt-4" aria-labelledby="history-title">
      <h2 id="history-title" className="text-xl font-bold text-white">Resultados reales</h2>
      <p className="mb-3 text-sm text-slate-400">Partidos jugados de la temporada descargada de API-Football.</p>
      {matches.length > 0 ? (
        <ul className="glass-panel divide-y divide-white/10 rounded-2xl">
          {matches.map((match) => (
            <li key={match.match_code} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 text-sm">
              <span className="flex items-center justify-end gap-2 text-right text-white">
                {match.home_team.short_name}
                <TeamShield team={match.home_team} size="sm" />
              </span>
              <span className="text-center">
                <span className="block text-lg font-black text-white">{match.score.home} - {match.score.away}</span>
                <span className="block text-[11px] text-slate-400">{match.league.name} · J{match.matchday} · {formatDateTime(match.match_date)}</span>
              </span>
              <span className="flex items-center gap-2 text-white">
                <TeamShield team={match.away_team} size="sm" />
                {match.away_team.short_name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-300">{error}</p> : null}
      {hasMore ? (
        <Button type="button" variant="secondary" className="mt-3" onClick={loadMore} disabled={isLoading}>
          {isLoading ? 'Cargando…' : opened ? 'Ver más resultados' : 'Ver resultados reales'}
        </Button>
      ) : null}
    </section>
  );
}

export default MatchHistory;
