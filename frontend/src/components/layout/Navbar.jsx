import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCOP } from '../../utils/format';
import BrandMark from '../ui/BrandMark';
import Button from '../ui/Button';
import { visibleNavItems } from './navItems';


function Navbar() {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050f1d]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <Link to="/" className="flex items-center gap-3">
          <BrandMark compact />
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-slate-300 lg:flex">
          {visibleNavItems(user).map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) => `transition ${isActive ? 'text-brand-gold' : 'hover:text-white'}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-2 text-right text-sm text-slate-300 md:block">
                <div className="font-semibold text-white">{user.username}</div>
                <div className="text-brand-gold">{isAdmin ? 'Administrador' : formatCOP(user.balance)}</div>
              </div>
              <Button type="button" onClick={handleLogout} className="px-3 py-2 text-sm">Salir</Button>
            </>
          ) : (
            <Link to="/login">
              <Button type="button" className="px-4 py-2 text-sm">Iniciar sesión</Button>
            </Link>
          )}
          {!isAdmin ? (
            <Button type="button" onClick={() => navigate(user ? '/wallet?tab=deposit' : '/login')} className="px-4 py-2 text-sm">
              Depositar
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
