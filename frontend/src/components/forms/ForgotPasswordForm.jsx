import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="eyebrow mb-1 block text-ink-muted">Correo electrónico</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="form-input"
          placeholder="usuario@email.com"
        />
      </div>

      {submitted && (
        <div className="border-l-2 border-emerald-400 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          Revisa tu correo para recuperar tu contraseña.
        </div>
      )}

      <Button type="submit" className="w-full">Enviar instrucciones</Button>

      <p className="text-center text-sm text-ink-muted">
        <Link to="/login" className="font-semibold text-gold hover:underline">Volver al inicio de sesión</Link>
      </p>
    </form>
  );
}

export default ForgotPasswordForm;
