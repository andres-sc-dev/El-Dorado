import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';

function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
        <h1 className="mb-6 text-3xl font-black text-white">Perfil del usuario</h1>
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-goldDeep text-2xl font-black text-slate-900">
              {user?.username?.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{user?.fullName}</h2>
              <p className="text-slate-300">@{user?.username}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Saldo</p>
              <p className="mt-2 text-2xl font-bold text-brand-gold">$ {user?.balance?.toLocaleString('es-CO')}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Correo</p>
              <p className="mt-2 text-lg font-semibold text-white">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default ProfilePage;
