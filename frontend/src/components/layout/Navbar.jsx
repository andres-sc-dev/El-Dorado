import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCOP } from '../../utils/format';
import BrandMark from '../ui/BrandMark';
import Button from '../ui/Button';
import { visibleNavItems } from './navItems';

// Iniciales para el avatar: dos primeras palabras del nombre, o la primera letra del usuario.
function initialsOf(user) {
  const words = String(user.fullName || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return String(words[0] || user.username || '?').slice(0, 2).toUpperCase();
}

// El perfil se abre desde el avatar; por eso no se repite como enlace del menú.
const linkClass = ({ isActive }) =>
  `relative flex min-h-[44px] shrink-0 items-center px-3 font-display text-[13px] font-semibold uppercase tracking-[0.16em] transition ${
    isActive
      ? 'text-gold after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-gold'
      : 'text-ink-muted hover:text-ink'
  }`;

function Navbar() {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const items = visibleNavItems(user).filter((item) => item.to !== '/profile');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const links = items.map((item) => (
    <NavLink key={item.label} to={item.to} end={item.to === '/'} className={linkClass}>
      {item.label}
    </NavLink>
  ));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-night/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4 xl:gap-8 lg:px-6">
        <Link to="/" title="Ir al inicio" className="flex min-h-[56px] shrink-0 items-center">
          <BrandMark compact />
        </Link>

        <nav aria-label="Principal" className="hidden h-14 items-stretch xl:flex">
          {links}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {user && !isAdmin ? (
            <span className="cut-s hidden min-h-[44px] items-center gap-2 bg-surface-2 px-3 md:flex">
              <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Saldo</span>
              <span className="font-mono text-sm font-semibold text-gold">{formatCOP(user.balance)}</span>
            </span>
          ) : null}
          {user && isAdmin ? (
            <span className="cut-s hidden min-h-[44px] items-center bg-surface-2 px-3 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-steel sm:flex">
              Administrador
            </span>
          ) : null}

          {!isAdmin ? (
            <Button type="button" onClick={() => navigate(user ? '/wallet?tab=deposit' : '/login')} className={`px-2.5 text-xs tracking-[0.1em] sm:px-4 sm:text-sm sm:tracking-[0.14em] ${user ? '' : 'hidden sm:inline-flex'}`}>
              Recargar
            </Button>
          ) : null}

          {user ? (
            <>
              <Link
                to="/profile"
                aria-label={`Perfil de ${user.username}`}
                title="Mi perfil"
                className="cut-s flex h-11 w-11 shrink-0 items-center justify-center bg-surface-2 font-display text-sm font-bold text-gold shadow-[inset_0_0_0_1px_theme(colors.gold/40%)] transition hover:bg-line-strong"
              >
                {initialsOf(user)}
              </Link>
              <Button type="button" variant="secondary" onClick={handleLogout} className="px-2.5 text-xs tracking-[0.1em] sm:px-4 sm:text-sm sm:tracking-[0.14em]">Salir</Button>
            </>
          ) : (
            <Link to="/login">
              <Button type="button" variant="secondary" className="whitespace-nowrap px-2.5 text-xs tracking-[0.1em] sm:px-4 sm:text-sm sm:tracking-[0.14em]">Iniciar sesión</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Menú en pantallas pequeñas: misma lista, desplazable dentro de su fila. */}
      <nav aria-label="Principal (móvil)" className="border-t border-line/70 xl:hidden">
        <div className="mx-auto flex max-w-7xl overflow-x-auto px-1">{links}</div>
      </nav>

      <div className="border-t border-line/70 bg-surface/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.2em] lg:px-6">
          <p className="text-ink-muted">
            Fútbol colombiano <span className="text-steel" aria-hidden="true">//</span> <span className="text-gold">Liga BetPlay</span>
          </p>
          <p className="text-ink-muted">
            <span className="text-gold">+18</span> · Dinero de prueba
          </p>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
