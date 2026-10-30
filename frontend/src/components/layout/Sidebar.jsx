import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const items = [
  { to: '/', label: 'Inicio' },
  { to: '/matches', label: 'Partidos' },
  { to: '/my-bets', label: 'Mis Apuestas' },
  { to: '/promotions', label: 'Promociones' },
  { to: '/wallet', label: 'Saldo' },
  { to: '/profile', label: 'Perfil' },
];

function Sidebar() {
  const { user } = useAuth();
  const availableBalance = Number(user?.balance ?? 0) + Number(user?.bonusBalance ?? 0);

  return (
    <aside className="hidden w-64 shrink-0 rounded-2xl border border-white/10 bg-[#0b1830]/90 p-4 lg:block">
      <div className="space-y-2">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-gold/15 text-brand-gold' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      {user && (
        <div className="mt-8 rounded-xl border border-white/10 bg-slate-900/20 p-3 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Usuario</div>
          <div className="mt-2 font-semibold text-white">{user.fullName || user.username}</div>
          <div className="mt-1 text-brand-gold">$ {availableBalance.toLocaleString('es-CO')}</div>
          <div className="mt-1 text-xs text-slate-400">Bono: $ {(user.bonusBalance ?? 0).toLocaleString('es-CO')}</div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
