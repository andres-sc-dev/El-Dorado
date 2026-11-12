import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { ErrorState, LoadingState } from '../components/ui/StatusStates';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { getCustomer } from '../services/walletService';
import { formatCOP, formatDocument } from '../utils/format';

const ROLE_LABELS = { USR: 'Usuario', ADM: 'Administrador' };

function Field({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/20 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  const { data: customer, error, isLoading, reload } = useApiData(getCustomer);

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
        <h1 className="mb-6 text-3xl font-black text-white">Perfil</h1>
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-goldDeep text-2xl font-black text-slate-900">
              {user?.username?.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{customer?.full_name ?? user?.fullName}</h2>
              <p className="text-slate-300">@{user?.username} · {ROLE_LABELS[user?.role] ?? user?.role}</p>
            </div>
          </div>

          {isLoading ? <div className="mt-6"><LoadingState message="Cargando tus datos…" /></div> : null}
          {error ? <div className="mt-6"><ErrorState message={error.message} onRetry={reload} /></div> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Correo" value={user?.email} />
            {user?.role !== 'ADM' ? <Field label="Saldo" value={formatCOP(user?.balance)} /> : null}
            {customer ? (
              <>
                <Field label={`Documento (${customer.document_type})`} value={formatDocument(customer.document_number)} />
                <Field label="Fecha de nacimiento" value={new Date(customer.birth_date).toLocaleDateString('es-CO', { timeZone: 'UTC' })} />
              </>
            ) : null}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default ProfilePage;
