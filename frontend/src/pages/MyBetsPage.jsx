import { Link } from 'react-router-dom';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatusStates';
import { useApiData } from '../hooks/useApiData';
import { getMyBets } from '../services/betService';
import { BET_STATUS_LABELS, formatCOP, formatDateTime, formatOdds } from '../utils/format';

const STATUS_STYLES = {
  OPEN: 'border-brand-gold/40 bg-brand-gold/10 text-brand-gold',
  WON: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  LOST: 'border-red-500/40 bg-red-500/10 text-red-200',
  REFUNDED: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  CANCELLED: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
};

function BetRow({ bet }) {
  const match = bet.match;
  return (
    <article className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/40 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tiquete {bet.ticket_code.slice(0, 8).toUpperCase()}</p>
          <p className="mt-1 font-bold text-white">
            {match ? `${match.home_team.name} vs ${match.away_team.name}` : bet.selection.match_code}
          </p>
          <p className="text-xs text-slate-400">
            {match ? (match.score ? `Final ${match.score.home} - ${match.score.away}` : formatDateTime(match.match_date)) : ''}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] ${STATUS_STYLES[bet.status] ?? ''}`}>
          {BET_STATUS_LABELS[bet.status] ?? bet.status_name}
        </span>
      </div>
      <div className="grid gap-3 p-4 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <p className="text-slate-400">{bet.selection.market_name}</p>
          <p className="font-semibold text-white">{bet.selection.outcome_name} · {formatOdds(bet.odds)}</p>
          <p className="mt-1 text-xs text-slate-500">Apostada el {formatDateTime(bet.placed_at)}</p>
        </div>
        <div className="space-y-1 sm:text-right">
          <p>Monto: <span className="font-semibold text-white">{formatCOP(bet.stake)}</span></p>
          <p>Pago posible: <span className="font-semibold text-white">{formatCOP(bet.potential_payout)}</span></p>
          {bet.status !== 'OPEN' ? (
            <p>Pagado: <span className="font-semibold text-brand-gold">{formatCOP(bet.payout)}</span></p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MyBetsPage() {
  const { data: bets, error, isLoading, reload } = useApiData(getMyBets);
  const list = bets ?? [];
  const openCount = list.filter((bet) => bet.status === 'OPEN').length;
  const totalStake = list.reduce((sum, bet) => sum + bet.stake, 0);

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-brand-gold">Actividad</p>
            <h1 className="mt-2 text-3xl font-black text-white">Mis apuestas</h1>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-panel rounded-2xl px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Apuestas</p>
              <p className="mt-2 text-xl font-bold text-white">{list.length}</p>
            </div>
            <div className="glass-panel rounded-2xl px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Abiertas</p>
              <p className="mt-2 text-xl font-bold text-white">{openCount}</p>
            </div>
            <div className="glass-panel rounded-2xl px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Apostado</p>
              <p className="mt-2 text-xl font-bold text-brand-gold">{formatCOP(totalStake)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? <LoadingState message="Cargando tus apuestas…" /> : null}
          {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
          {!isLoading && !error && list.length === 0 ? (
            <EmptyState title="Aún no has apostado" message={<>Elige una cuota en <Link to="/matches" className="text-brand-gold">Partidos</Link> para hacer tu primera apuesta.</>} />
          ) : null}
          {!isLoading && !error ? list.map((bet) => <BetRow key={bet.ticket_code} bet={bet} />) : null}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default MyBetsPage;
