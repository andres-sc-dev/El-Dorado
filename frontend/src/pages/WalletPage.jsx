import { useLocation } from 'react-router-dom';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';

// Parche de seguridad (Fase 1): el depósito directo sumaba saldo sin ningún pago y se quitó.
// Las recargas llegarán con Wompi Sandbox. El saldo de prueba entra por la semilla de demo.
function WalletPage() {
  const location = useLocation();
  const { user } = useAuth();
  const hasDepositTab = new URLSearchParams(location.search).get('tab') === 'deposit';
  const balance = user?.balance;

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
        <h1 className="mb-8 text-3xl font-black text-white">Depósitos y retiros</h1>

        <div className="glass-panel mb-6 rounded-2xl p-5">
          <p className="text-sm text-slate-300">Saldo disponible</p>
          <p className="mt-1 text-3xl font-black text-white">
            {balance === null || balance === undefined
              ? 'No disponible'
              : `$ ${Number(balance).toLocaleString('es-CO')}`}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section
            aria-labelledby="deposit-title"
            className={`glass-panel rounded-2xl p-5 ${hasDepositTab ? 'ring-2 ring-brand-gold/60' : ''}`}
          >
            <h2 id="deposit-title" className="text-xl font-bold text-white">Recargar</h2>
            <p role="status" className="mt-4 rounded-xl border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-sm text-amber-100">
              Recargas con Wompi próximamente.
            </p>
            <p className="mt-3 text-sm text-slate-400">
              Proyecto académico: no se usa dinero real. Mientras tanto tu cuenta tiene saldo de prueba.
            </p>
          </section>

          <section aria-labelledby="withdraw-title" className="glass-panel rounded-2xl p-5">
            <h2 id="withdraw-title" className="text-xl font-bold text-white">Retirar</h2>
            <p role="status" className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-200">
              Los retiros están deshabilitados temporalmente.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default WalletPage;
