import { useEffect, useMemo, useState } from 'react';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { getUserBets } from '../services/betService';

function MyBetsPage() {
  const { user } = useAuth();
  const [bets, setBets] = useState([]);

  useEffect(() => {
    if (user) {
      getUserBets(user.id).then(setBets);
    } else {
      setBets([]);
    }
  }, [user]);

  const stats = useMemo(() => {
    const totalStake = bets.reduce((sum, bet) => sum + Number(bet.stake || 0), 0);
    const totalPotential = bets.reduce((sum, bet) => sum + Number(bet.potentialPayout || 0), 0);
    const pending = bets.filter((bet) => (bet.status || '').toLowerCase() === 'pending').length;

    return { totalStake, totalPotential, pending };
  }, [bets]);

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-brand-gold">Actividad</p>
            <h1 className="mt-2 text-3xl font-black text-white">Historial de apuestas</h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass-panel rounded-2xl px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Apuestas</p>
              <p className="mt-2 text-xl font-bold text-white">{bets.length}</p>
            </div>
            <div className="glass-panel rounded-2xl px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pendientes</p>
              <p className="mt-2 text-xl font-bold text-white">{stats.pending}</p>
            </div>
            <div className="glass-panel rounded-2xl px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Stake</p>
              <p className="mt-2 text-xl font-bold text-brand-gold">$ {stats.totalStake.toLocaleString('es-CO')}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {bets.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-slate-300">
              <p className="text-lg font-semibold text-white">Aún no has realizado apuestas</p>
              <p className="mt-2">Cuando hagas clic en “Realizar apuesta”, aparecerán aquí con todo el detalle.</p>
            </div>
          ) : (
            bets.map((bet) => (
              <div key={bet.id} className="glass-panel overflow-hidden rounded-2xl">
                <div className="border-b border-white/10 bg-slate-900/40 px-4 py-3 md:flex md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">#{bet.id}</p>
                    <p className="mt-1 text-lg font-bold text-white">Apuesta {bet.status}</p>
                  </div>

                  <div className="mt-2 text-sm text-slate-300 md:mt-0 md:text-right">
                    <p>{new Date(bet.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    <p className="mt-1 text-brand-gold">Pago potencial: $ {Number(bet.potentialPayout || 0).toLocaleString('es-CO')}</p>
                  </div>
                </div>

                <div className="p-4 md:grid md:grid-cols-[1.2fr_0.8fr] md:gap-4">
                  <div className="space-y-2">
                    {(bet.selections || []).map((selection) => (
                      <div key={`${bet.id}-${selection.oddId || selection.id}`} className="rounded-xl border border-white/10 bg-slate-900/25 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          {selection.matchLabel || selection.matchId || 'Partido'}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">
                            {selection.oddLabel || 'Seleccion'} · {Number(selection.oddValueAtBetTime || selection.value || 1).toFixed(2)}
                          </p>
                          <span className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">
                            {selection.result || 'pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/20 p-4 md:mt-0">
                    <div className="space-y-3 text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span>Stake</span>
                        <span className="font-semibold text-white">$ {Number(bet.stake || 0).toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Cuota total</span>
                        <span className="font-semibold text-white">{Number(bet.totalOdds || 1).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Ganancia estimada</span>
                        <span className="font-semibold text-brand-gold">$ {Number(bet.potentialPayout || 0).toLocaleString('es-CO')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default MyBetsPage;
