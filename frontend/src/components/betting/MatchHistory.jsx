import { useState } from 'react';
import { getMatchHistory } from '../../services/matchService';
import { formatDateTime } from '../../utils/format';
import Button from '../ui/Button';
import Panel from '../ui/Panel';
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
      <h2 id="history-title" className="font-display text-xl font-bold uppercase tracking-[0.12em] text-ink">Resultados reales</h2>
      <p className="mb-3 text-sm text-ink-muted">Partidos jugados de la temporada descargada de API-Football.</p>
      {matches.length > 0 ? (
        <Panel>
          <ul className="divide-y divide-line">
          {matches.map((match) => (
            <li key={match.match_code} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center justify-end gap-2 text-right text-ink">
                {match.home_team.short_name}
                <TeamShield team={match.home_team} size="sm" />
              </span>
              <span className="text-center">
                <span className="block font-mono text-lg font-bold text-ink">{match.score.home} - {match.score.away}</span>
                <span className="block font-mono text-[11px] text-ink-muted">Liga BetPlay · J{match.matchday} · {formatDateTime(match.match_date)}</span>
              </span>
              <span className="flex min-w-0 items-center gap-2 text-ink">
                <TeamShield team={match.away_team} size="sm" />
                {match.away_team.short_name}
              </span>
            </li>
          ))}
          </ul>
        </Panel>
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
