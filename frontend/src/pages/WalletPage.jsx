import { useLocation } from 'react-router-dom';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatusStates';
import RechargePanel from '../components/wallet/RechargePanel';
import { useApiData } from '../hooks/useApiData';
import { getWallet } from '../services/walletService';
import { formatCOP, formatDateTime } from '../utils/format';

// Billetera: saldo y movimientos de PostgreSQL (GET /api/wallet/me) y recargas con Wompi Sandbox.
// Los retiros siguen deshabilitados.
function WalletPage() {
  const location = useLocation();
  const hasDepositTab = new URLSearchParams(location.search).get('tab') === 'deposit';
  const { data: wallet, error, isLoading, reload } = useApiData(getWallet);

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
        <h1 className="mb-8 text-3xl font-black text-white">Billetera</h1>

        {isLoading ? <LoadingState message="Cargando tu billetera…" /> : null}
        {error ? <ErrorState message={error.message} onRetry={reload} /> : null}

        {wallet ? (
          <div className="glass-panel mb-6 rounded-2xl p-5">
            <p className="text-sm text-slate-300">Saldo disponible · cuenta {wallet.account_number}</p>
            <p className="mt-1 text-3xl font-black text-white">{formatCOP(wallet.balance)}</p>
          </div>
        ) : null}

        <div className="mb-6 grid items-start gap-6 md:grid-cols-2">
          <RechargePanel highlighted={hasDepositTab} onCredited={reload} />

          <section aria-labelledby="withdraw-title" className="glass-panel rounded-2xl p-5">
            <h2 id="withdraw-title" className="text-xl font-bold text-white">Retirar</h2>
            <p role="status" className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-200">
              Retiros próximamente.
            </p>
          </section>
        </div>

        {wallet ? (
          <section aria-labelledby="movements-title">
            <h2 id="movements-title" className="mb-3 text-xl font-bold text-white">Movimientos</h2>
            {wallet.movements.length === 0 ? (
              <EmptyState title="Sin movimientos" message="Aquí verás apuestas, premios y recargas." />
            ) : (
              <ul className="glass-panel divide-y divide-white/10 rounded-2xl">
                {wallet.movements.map((movement) => (
                  <li key={movement.reference} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-white">{movement.type_name}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(movement.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className={movement.direction > 0 ? 'font-bold text-emerald-300' : 'font-bold text-red-300'}>
                        {movement.direction > 0 ? '+' : '−'} {formatCOP(movement.amount)}
                      </p>
                      <p className="text-xs text-slate-400">Saldo {formatCOP(movement.resulting_balance)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
      <Footer />
    </div>
  );
}

export default WalletPage;
