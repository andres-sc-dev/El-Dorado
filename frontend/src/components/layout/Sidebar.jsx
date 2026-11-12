import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCOP } from '../../utils/format';
import { visibleNavItems } from './navItems';

function Sidebar() {
  const { user, isAdmin } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 rounded-2xl border border-white/10 bg-[#0b1830]/90 p-4 lg:block">
      <div className="space-y-2">
        {visibleNavItems(user).map((item) => (
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
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{isAdmin ? 'Administrador' : 'Usuario'}</div>
          <div className="mt-2 font-semibold text-white">{user.fullName || user.username}</div>
          {!isAdmin ? <div className="mt-1 text-brand-gold">{formatCOP(user.balance)}</div> : null}
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
