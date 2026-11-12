import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Exige sesión y, si se indica, uno de los roles: <ProtectedRoute roles={['ADM']} />.
// Es solo comodidad de la interfaz: la API vuelve a exigir sesión y rol en cada ruta.
function ProtectedRoute({ roles }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-center text-slate-300">Cargando sesión…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export default ProtectedRoute;
