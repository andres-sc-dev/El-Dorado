import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBetSlip } from '../../context/BetSlipContext';
import { formatDateTime, MATCH_STATUS_LABELS } from '../../utils/format';
import Panel from '../ui/Panel';
import TeamShield from '../ui/TeamShield';
import OddButton from './OddButton';

// Hora local del partido para la fila compacta del inicio (el día va en el encabezado del grupo).
function matchTime(value) {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Un partido de GET /api/matches. El 1X2 se ve siempre; el resto de mercados se despliega.
// compact: fila del inicio (hora, equipos y 1 X 2 en línea). Si no, tarjeta completa de Partidos.
// La liga se muestra como "Liga BetPlay" y no se muestra el código del partido: los partidos de
// demostración traen en league.name la marca de réplica, que solo se oculta aquí (los datos no cambian).
function MatchCard({ match, compact = false }) {
  const { isAdmin } = useAuth();
  const { selection, select } = useBetSlip();
  const [expanded, setExpanded] = useState(false);
  const matchLabel = `${match.home_team.short_name} vs ${match.away_team.short_name}`;
  const markets = expanded ? match.markets : match.markets.slice(0, 1);
  const closed = !match.is_betting_open || match.markets.length === 0;

  const isSelected = (market, outcome) => selection
    && selection.matchCode === match.match_code
    && selection.marketCode === market.market_code
    && selection.outcomeCode === outcome.outcome_code
    && selection.line === outcome.line;

  const choose = (market, outcome) => select({
    matchCode: match.match_code,
    matchLabel,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    marketCode: market.market_code,
    marketName: market.name,
    outcomeCode: outcome.outcome_code,
    outcomeName: outcome.name,
    line: outcome.line,
    oddValue: outcome.odd_value,
  });

  const oddButtons = (market) => market.outcomes.map((outcome) => (
    <OddButton
      key={outcome.outcome_code}
      label={outcome.name}
      value={outcome.odd_value}
      active={isSelected(market, outcome)}
      disabled={isAdmin}
      onClick={() => choose(market, outcome)}
    />
  ));

  if (compact) {
    return (
      <article className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 px-3 py-3 md:grid-cols-[56px_minmax(0,1fr)_264px] md:px-4">
        <time dateTime={match.match_date} className="font-mono text-sm font-semibold text-steel">
          {match.score ? `${match.score.home}-${match.score.away}` : matchTime(match.match_date)}
        </time>
        <div className="min-w-0 space-y-1.5">
          <p className="flex items-center gap-2">
            <TeamShield team={match.home_team} size="sm" />
            <span className="truncate text-sm font-semibold text-ink">{match.home_team.name}</span>
          </p>
          <p className="flex items-center gap-2">
            <TeamShield team={match.away_team} size="sm" />
            <span className="truncate text-sm font-semibold text-ink">{match.away_team.name}</span>
          </p>
        </div>
        <div className="col-span-2 md:col-span-1">
          {closed ? (
            <p className="cut-s bg-surface-2 px-3 py-2 text-center text-sm text-ink-muted">Apuestas cerradas</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">{oddButtons(match.markets[0])}</div>
          )}
        </div>
      </article>
    );
  }

  return (
    <Panel as="article" innerClassName="p-4">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <p className="eyebrow text-steel">Liga BetPlay · Jornada {match.matchday}</p>
          <h3 className="mt-1 font-display text-lg font-bold uppercase tracking-[0.06em] text-ink">
            {match.home_team.name} vs {match.away_team.name}
          </h3>
          <p className="text-xs text-ink-muted">{match.stadium.name}, {match.stadium.city}</p>
        </div>
        <span className="cut-s shrink-0 bg-gold/10 px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
          {MATCH_STATUS_LABELS[match.status] ?? match.status_name}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="truncate font-semibold text-ink">{match.home_team.short_name}</span>
          <TeamShield team={match.home_team} size="md" />
        </div>
        <div className="text-center font-mono text-xs text-ink-muted sm:text-sm">
          {match.score ? (
            <span className="text-2xl font-bold text-ink">{match.score.home} - {match.score.away}</span>
          ) : (
            formatDateTime(match.match_date)
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <TeamShield team={match.away_team} size="md" />
          <span className="truncate font-semibold text-ink">{match.away_team.short_name}</span>
        </div>
      </div>

      {closed ? (
        <p className="cut-s bg-surface-2 px-3 py-2 text-sm text-ink-muted">
          Apuestas cerradas
        </p>
      ) : (
        <div className="space-y-3">
          {markets.map((market) => (
            <div key={`${market.market_code}|${market.line}`}>
              <p className="eyebrow mb-2 text-ink-muted">{market.name}</p>
              <div className="flex flex-wrap gap-2">{oddButtons(market)}</div>
            </div>
          ))}
          {match.markets.length > 1 ? (
            <button
              type="button"
              className="min-h-[44px] font-display text-xs font-bold uppercase tracking-[0.16em] text-gold hover:text-ink"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Ver menos mercados' : `Ver ${match.markets.length - 1} mercados más`}
            </button>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

export default MatchCard;
