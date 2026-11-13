import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import Panel from '../components/ui/Panel';
import { ErrorState, LoadingState } from '../components/ui/StatusStates';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { getCustomer } from '../services/walletService';
import { formatCOP, formatDocument } from '../utils/format';

const ROLE_LABELS = { USR: 'Usuario', ADM: 'Administrador' };

function Field({ label, value }) {
  return (
    <div className="cut-s bg-surface-2 p-4">
      <p className="eyebrow text-ink-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold text-ink [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  const { data: customer, error, isLoading, reload } = useApiData(getCustomer);

  return (
    <div className="page-shell">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 lg:px-6">
        <h1 className="mb-6 font-display text-3xl font-bold uppercase tracking-[0.08em] text-ink">Perfil</h1>
        <Panel innerClassName="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="cut-s flex h-16 w-16 shrink-0 items-center justify-center bg-gold font-display text-2xl font-bold text-night">
              {user?.username?.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold uppercase tracking-[0.06em] text-ink [overflow-wrap:anywhere]">{customer?.full_name ?? user?.fullName}</h2>
              <p className="text-ink-muted">@{user?.username} · {ROLE_LABELS[user?.role] ?? user?.role}</p>
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
        </Panel>
      </main>
      <Footer />
    </div>
  );
}

export default ProfilePage;
