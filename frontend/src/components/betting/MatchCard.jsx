import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBetSlip } from '../../context/BetSlipContext';
import { formatDateTime, MATCH_STATUS_LABELS } from '../../utils/format';
import OddButton from './OddButton';

// Un partido de GET /api/matches. El 1X2 se ve siempre; el resto de mercados se despliega.
function MatchCard({ match, compact = false }) {
  const { isAdmin } = useAuth();
  const { selection, select } = useBetSlip();
  const [expanded, setExpanded] = useState(false);
  const matchLabel = `${match.home_team.short_name} vs ${match.away_team.short_name}`;
  const markets = expanded ? match.markets : match.markets.slice(0, 1);

  const isSelected = (market, outcome) => selection
    && selection.matchCode === match.match_code
    && selection.marketCode === market.market_code
    && selection.outcomeCode === outcome.outcome_code
    && selection.line === outcome.line;

  const choose = (market, outcome) => select({
    matchCode: match.match_code,
    matchLabel,
    marketCode: market.market_code,
    marketName: market.name,
    outcomeCode: outcome.outcome_code,
    outcomeName: outcome.name,
    line: outcome.line,
    oddValue: outcome.odd_value,
  });

  return (
    <article className="glass-panel rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {match.league.name} · Jornada {match.matchday} · {match.match_code}
          </p>
          <h3 className="text-lg font-bold text-white">{match.home_team.name} vs {match.away_team.name}</h3>
          <p className="text-xs text-slate-400">{match.stadium.name}, {match.stadium.city}</p>
        </div>
        <span className="shrink-0 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-xs font-semibold text-brand-gold">
          {MATCH_STATUS_LABELS[match.status] ?? match.status_name}
        </span>
      </div>

      <div className="mb-4 text-center text-sm text-slate-300">
        {match.score ? (
          <span className="text-2xl font-black text-white">{match.score.home} - {match.score.away}</span>
        ) : (
          formatDateTime(match.match_date)
        )}
      </div>

      {!match.is_betting_open || match.markets.length === 0 ? (
        <p className="rounded-lg border border-slate-600/50 bg-slate-800/40 px-3 py-2 text-sm text-slate-400">
          Apuestas cerradas
        </p>
      ) : (
        <div className="space-y-3">
          {markets.map((market) => (
            <div key={`${market.market_code}|${market.line}`}>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">{market.name}</p>
              <div className="flex flex-wrap gap-2">
                {market.outcomes.map((outcome) => (
                  <OddButton
                    key={outcome.outcome_code}
                    label={outcome.name}
                    value={outcome.odd_value}
                    active={isSelected(market, outcome)}
                    disabled={isAdmin}
                    onClick={() => choose(market, outcome)}
                  />
                ))}
              </div>
            </div>
          ))}
          {!compact && match.markets.length > 1 ? (
            <button type="button" className="text-sm font-semibold text-brand-gold" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Ver menos mercados' : `Ver ${match.markets.length - 1} mercados más`}
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default MatchCard;
