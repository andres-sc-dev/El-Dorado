import { Link } from 'react-router-dom';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import Panel from '../components/ui/Panel';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatusStates';
import { useApiData } from '../hooks/useApiData';
import { getMyBets } from '../services/betService';
import { BET_STATUS_LABELS, formatCOP, formatDateTime, formatOdds } from '../utils/format';

const STATUS_STYLES = {
  OPEN: 'bg-gold/15 text-gold',
  WON: 'bg-emerald-500/15 text-emerald-200',
  LOST: 'bg-red-500/15 text-red-200',
  REFUNDED: 'bg-steel/15 text-steel',
  CANCELLED: 'bg-surface-2 text-ink-muted',
};

function BetRow({ bet }) {
  const match = bet.match;
  return (
    <Panel as="article" innerClassName="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-4 py-3">
        <div>
          <p className="eyebrow text-ink-muted">Tiquete <span className="font-mono tracking-normal text-steel">{bet.ticket_code.slice(0, 8).toUpperCase()}</span></p>
          <p className="mt-1 font-display font-bold uppercase tracking-[0.06em] text-ink">
            {match ? `${match.home_team.name} vs ${match.away_team.name}` : bet.selection.match_code}
          </p>
          <p className="font-mono text-xs text-ink-muted">
            {match ? (match.score ? `Final ${match.score.home} - ${match.score.away}` : formatDateTime(match.match_date)) : ''}
          </p>
        </div>
        <span className={`cut-s px-3 py-1 font-display text-xs font-bold uppercase tracking-[0.15em] ${STATUS_STYLES[bet.status] ?? ''}`}>
          {BET_STATUS_LABELS[bet.status] ?? bet.status_name}
        </span>
      </div>
      <div className="grid gap-3 p-4 text-sm text-ink-muted sm:grid-cols-2">
        <div>
          <p className="text-ink-muted">{bet.selection.market_name}</p>
          <p className="font-semibold text-ink">{bet.selection.outcome_name} · <span className="font-mono text-gold">{formatOdds(bet.odds)}</span></p>
          <p className="mt-1 text-xs text-ink-muted">Apostada el <span className="font-mono">{formatDateTime(bet.placed_at)}</span></p>
        </div>
        <div className="space-y-1 sm:text-right">
          <p>Monto: <span className="font-mono font-semibold text-ink">{formatCOP(bet.stake)}</span></p>
          <p>Pago posible: <span className="font-mono font-semibold text-ink">{formatCOP(bet.potential_payout)}</span></p>
          {bet.status !== 'OPEN' ? (
            <p>Pagado: <span className="font-mono font-semibold text-gold">{formatCOP(bet.payout)}</span></p>
          ) : null}
        </div>
      </div>
    </Panel>
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-gold">Actividad</p>
            <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-[0.08em] text-ink">Mis apuestas</h1>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Panel size="sm" innerClassName="px-3 py-3 sm:px-4">
              <p className="eyebrow text-[10px] text-ink-muted sm:text-xs">Apuestas</p>
              <p className="mt-2 font-mono text-base font-bold text-ink sm:text-xl">{list.length}</p>
            </Panel>
            <Panel size="sm" innerClassName="px-3 py-3 sm:px-4">
              <p className="eyebrow text-[10px] text-ink-muted sm:text-xs">Abiertas</p>
              <p className="mt-2 font-mono text-base font-bold text-ink sm:text-xl">{openCount}</p>
            </Panel>
            <Panel size="sm" innerClassName="px-3 py-3 sm:px-4">
              <p className="eyebrow text-[10px] text-ink-muted sm:text-xs">Apostado</p>
              <p className="mt-2 font-mono text-sm font-bold text-gold [overflow-wrap:anywhere] sm:text-xl">{formatCOP(totalStake)}</p>
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? <LoadingState message="Cargando tus apuestas…" /> : null}
          {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
          {!isLoading && !error && list.length === 0 ? (
            <EmptyState title="Aún no has apostado" message={<>Elige una cuota en <Link to="/matches" className="text-gold">Partidos</Link> para hacer tu primera apuesta.</>} />
          ) : null}
          {!isLoading && !error ? list.map((bet) => <BetRow key={bet.ticket_code} bet={bet} />) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default MyBetsPage;
