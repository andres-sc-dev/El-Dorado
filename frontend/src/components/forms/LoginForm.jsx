import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

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
      await login(email, password);
      navigate('/');
    } catch (submitError) {
      setError(submitError.message || 'No se pudo iniciar sesión');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm text-slate-300">Correo o usuario</label>
        <input value={email} onChange={(event) => setEmail(event.target.value)} className="form-input" placeholder="andres@example.com" />
      </div>

      <div>
        <label className="mb-1 block text-sm text-slate-300">Contraseña</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="form-input pr-10"
            placeholder="••••••••"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="rounded border-white/10 bg-brand-input" />
          Recordarme
        </label>
        <Link to="/forgot-password" className="text-brand-gold">¿Olvidaste tu contraseña?</Link>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <Button type="submit" className="w-full">Iniciar sesión</Button>

      <p className="text-center text-sm text-slate-300">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="font-semibold text-brand-gold">Regístrate</Link>
      </p>
    </form>
  );
}

export default LoginForm;
