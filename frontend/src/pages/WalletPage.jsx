import { useLocation } from 'react-router-dom';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import Panel from '../components/ui/Panel';
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
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 lg:px-6">
        <h1 className="mb-8 font-display text-3xl font-bold uppercase tracking-[0.08em] text-ink">Billetera</h1>

        {isLoading ? <LoadingState message="Cargando tu billetera…" /> : null}
        {error ? <ErrorState message={error.message} onRetry={reload} /> : null}

        {wallet ? (
          <Panel tone="strong" className="mb-6" innerClassName="hero-glow p-5">
            <p className="eyebrow text-ink-muted">Saldo disponible · cuenta <span className="font-mono tracking-normal text-steel">{wallet.account_number}</span></p>
            <p className="mt-2 font-mono text-3xl font-bold text-gold [overflow-wrap:anywhere]">{formatCOP(wallet.balance)}</p>
          </Panel>
        ) : null}

        <div className="mb-6 grid items-start gap-6 md:grid-cols-2">
          <RechargePanel highlighted={hasDepositTab} onCredited={reload} />

          <Panel as="section" aria-labelledby="withdraw-title" innerClassName="p-5">
            <h2 id="withdraw-title" className="font-display text-xl font-bold uppercase tracking-[0.1em] text-ink">Retirar</h2>
            <p role="status" className="cut-s mt-4 bg-surface-2 px-4 py-3 text-sm text-ink">
              Retiros próximamente.
            </p>
          </Panel>
        </div>

        {wallet ? (
          <section aria-labelledby="movements-title">
            <h2 id="movements-title" className="mb-3 font-display text-xl font-bold uppercase tracking-[0.1em] text-ink">Movimientos</h2>
            {wallet.movements.length === 0 ? (
              <EmptyState title="Sin movimientos" message="Aquí verás apuestas, premios y recargas." />
            ) : (
              <Panel>
              <ul className="divide-y divide-line">
                {wallet.movements.map((movement) => (
                  <li key={movement.reference} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-ink">{movement.type_name}</p>
                      <p className="font-mono text-xs text-ink-muted">{formatDateTime(movement.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className={movement.direction > 0 ? 'font-mono font-bold text-emerald-300' : 'font-mono font-bold text-red-300'}>
                        {movement.direction > 0 ? '+' : '−'} {formatCOP(movement.amount)}
                      </p>
                      <p className="font-mono text-xs text-ink-muted">Saldo {formatCOP(movement.resulting_balance)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              </Panel>
            )}
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

export default WalletPage;
