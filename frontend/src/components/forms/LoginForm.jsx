import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import GoogleSignInButton from './GoogleSignInButton';

function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const loggedUser = await login(email, password);
      navigate(loggedUser?.role === 'ADM' ? '/admin' : '/');
    } catch (submitError) {
      setError(submitError.message || 'No se pudo iniciar sesión');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="eyebrow mb-1 block text-ink-muted">Correo o usuario</label>
        <input value={email} onChange={(event) => setEmail(event.target.value)} className="form-input" placeholder="andres@example.com" />
      </div>

      <div>
        <label className="eyebrow mb-1 block text-ink-muted">Contraseña</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="form-input pr-20"
            placeholder="••••••••"
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 min-h-[40px] -translate-y-1/2 px-2 font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted hover:text-gold"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
        <label className="flex min-h-[44px] items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-gold" />
          Recordarme
        </label>
        <Link to="/forgot-password" className="flex min-h-[44px] items-center text-gold hover:underline">¿Olvidaste tu contraseña?</Link>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <Button type="submit" className="w-full">Iniciar sesión</Button>

      <div className="eyebrow flex items-center gap-3 text-ink-muted">
        <span className="h-px flex-1 bg-line" /> o <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleSignInButton />

      <p className="text-center text-sm text-ink-muted">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-semibold text-gold hover:underline">Regístrate</Link>
      </p>
    </form>
  );
}

export default LoginForm;
