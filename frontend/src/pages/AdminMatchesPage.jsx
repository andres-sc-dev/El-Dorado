import { useState } from 'react';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import TeamShield from '../components/ui/TeamShield';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatusStates';
import { useApiData } from '../hooks/useApiData';
import { finishMatch, getAdminMatches } from '../services/adminService';
import { formatCOP, formatDateTime, MATCH_STATUS_LABELS } from '../utils/format';

// Panel ADM: finalizar un partido con su marcador y liquidar sus apuestas.
// La ruta está protegida en el frontend (ProtectedRoute roles ADM) y en la API (requireRole).

function parseGoals(value) {
  return /^\d{1,2}$/.test(String(value)) && Number(value) <= 30 ? Number(value) : null;
}

function ConfirmModal({ match, homeGoals, awayGoals, onCancel, onConfirm, isSubmitting, error }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="glass-panel w-full max-w-md rounded-2xl bg-[#0b1830] p-6">
        <h2 id="confirm-title" className="text-xl font-bold text-white">Finalizar partido</h2>
        <p className="mt-3 text-slate-200">
          {match.home_team.name} <span className="font-black text-brand-gold">{homeGoals} - {awayGoals}</span> {match.away_team.name}
        </p>
        <p className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          Esto liquida {match.open_bets} {match.open_bets === 1 ? 'apuesta' : 'apuestas'} ({formatCOP(match.open_stake)} apostados) y no se puede deshacer.
        </p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Liquidando…' : 'Finalizar y liquidar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MatchRow({ match, onFinish }) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const homeGoals = parseGoals(home);
  const awayGoals = parseGoals(away);
  const ready = homeGoals !== null && awayGoals !== null;

  return (
    <tr className="border-t border-white/10">
      <td className="px-3 py-3">
        <p className="flex items-center gap-2 font-semibold text-white">
          <TeamShield team={match.home_team} size="sm" />
          {match.home_team.short_name} vs {match.away_team.short_name}
          <TeamShield team={match.away_team} size="sm" />
        </p>
        <p className="text-xs text-slate-400">{match.match_code} · {formatDateTime(match.match_date)}</p>
      </td>
      <td className="px-3 py-3 text-sm">{MATCH_STATUS_LABELS[match.status] ?? match.status}</td>
      <td className="px-3 py-3 text-sm">{match.open_bets} · {formatCOP(match.open_stake)}</td>
      <td className="px-3 py-3">
        {match.can_finish ? (
          <div className="flex items-center gap-2">
            <input aria-label={`Goles de ${match.home_team.name}`} className="form-input w-14 text-center" inputMode="numeric" value={home} onChange={(event) => setHome(event.target.value)} />
            <span className="text-slate-400">-</span>
            <input aria-label={`Goles de ${match.away_team.name}`} className="form-input w-14 text-center" inputMode="numeric" value={away} onChange={(event) => setAway(event.target.value)} />
            <Button type="button" className="px-3 py-1 text-sm disabled:opacity-50" disabled={!ready} onClick={() => onFinish(match, homeGoals, awayGoals)}>
              Finalizar
            </Button>
          </div>
        ) : (
          <span className="font-bold text-white">{match.score ? `${match.score.home} - ${match.score.away}` : '—'}</span>
        )}
      </td>
    </tr>
  );
}

function AdminMatchesPage() {
  const { data: matches, error, isLoading, reload } = useApiData(getAdminMatches);
  const [pending, setPending] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [summary, setSummary] = useState(null);

  const confirm = async () => {
    setIsSubmitting(true);
    setModalError(null);
    try {
      const result = await finishMatch(pending.match.match_code, pending.homeGoals, pending.awayGoals);
      setSummary(result);
      setPending(null);
      reload();
    } catch (requestError) {
      setModalError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <p className="text-xs uppercase tracking-[0.25em] text-brand-gold">Administración</p>
        <h1 className="mb-6 text-3xl font-black text-white">Finalizar partidos</h1>

        {summary ? (
          <div role="status" className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-100">
            <p className="font-bold">Partido {summary.match_code} finalizado {summary.score.home} - {summary.score.away}.</p>
            <p className="mt-1 text-sm">
              Liquidadas: {summary.settled} · ganadas: {summary.won} · perdidas: {summary.lost} · devueltas: {summary.refunded} · total pagado: {formatCOP(summary.total_paid)}
            </p>
          </div>
        ) : null}

        {isLoading ? <LoadingState message="Cargando partidos…" /> : null}
        {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
        {matches && matches.length === 0 ? <EmptyState title="No hay partidos" /> : null}

        {matches && matches.length > 0 ? (
          <div className="glass-panel overflow-x-auto rounded-2xl">
            <table className="w-full text-left text-slate-300">
              <thead className="text-xs uppercase tracking-[0.15em] text-slate-400">
                <tr>
                  <th className="px-3 py-3">Partido</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Apuestas abiertas</th>
                  <th className="px-3 py-3">Marcador final</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <MatchRow
                    key={match.match_code}
                    match={match}
                    onFinish={(selected, homeGoals, awayGoals) => { setModalError(null); setPending({ match: selected, homeGoals, awayGoals }); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {pending ? (
        <ConfirmModal
          match={pending.match}
          homeGoals={pending.homeGoals}
          awayGoals={pending.awayGoals}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
          isSubmitting={isSubmitting}
          error={modalError}
        />
      ) : null}
      <Footer />
    </div>
  );
}

export default AdminMatchesPage;
