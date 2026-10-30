import OddButton from './OddButton';

function MatchCard({ match, onSelectOdd }) {
  const isFinished = match.status === 'finished' || match.status === 'cancelled';

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{match.leagueName}</p>
          <h3 className="text-lg font-bold text-white">{match.homeTeam?.name} vs {match.awayTeam?.name}</h3>
        </div>
        <span className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-xs font-semibold text-brand-gold">{match.status}</span>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 font-bold text-brand-gold">
            {match.homeTeam?.shortName}
          </div>
          <span>{match.homeTeam?.name}</span>
        </div>
        <div className="text-center text-xs uppercase tracking-[0.2em] text-slate-400">
          {isFinished ? (
            <span className="text-base font-black text-white">{match.homeScore ?? 0} - {match.awayScore ?? 0}</span>
          ) : (
            match.startTime ? new Date(match.startTime).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>{match.awayTeam?.name}</span>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 font-bold text-brand-gold">
            {match.awayTeam?.shortName}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {isFinished ? (
          <p className="rounded-lg border border-slate-600/50 bg-slate-800/40 px-3 py-2 text-sm text-slate-400">
            Apuestas cerradas
          </p>
        ) : match.odds?.map((odd) => (
          <OddButton
            key={odd.id}
            label={odd.label}
            value={odd.value}
            onClick={() => onSelectOdd({ ...odd, matchId: match.id, matchLabel: `${match.homeTeam?.shortName} vs ${match.awayTeam?.shortName}` })}
          />
        ))}
      </div>
    </div>
  );
}

export default MatchCard;
