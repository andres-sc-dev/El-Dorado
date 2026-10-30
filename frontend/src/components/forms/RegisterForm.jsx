import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';

function getAdultBirthDateLimit() {
  const today = new Date();
  const latestBirthDate = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
  );

  const month = String(latestBirthDate.getMonth() + 1).padStart(2, '0');
  const day = String(latestBirthDate.getDate()).padStart(2, '0');

  // Usamos componentes locales para no adelantar o atrasar el límite por
  // conversiones de zona horaria al transformar la fecha a ISO.
  return `${latestBirthDate.getFullYear()}-${month}-${day}`;
}

function RegisterForm() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const adultBirthDateLimit = getAdultBirthDateLimit();
  const [formData, setFormData] = useState({
    fullName: '',
    documentNumber: '',
    birthDate: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.birthDate > adultBirthDateLimit) {
      setError('Debes tener al menos 18 años para registrarte');
      return;
    }

    if (!acceptedTerms) {
      setError('Debes aceptar los términos y condiciones');
      return;
    }

    try {
      await register({
        fullName: formData.fullName,
        documentNumber: formData.documentNumber,
        birthDate: formData.birthDate,
        email: formData.email,
        username: formData.username,
        password: formData.password,
      });
      navigate('/login');
    } catch (submitError) {
      setError(submitError.message || 'No se pudo crear la cuenta');
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-slate-300">Nombre completo</label>
        <input name="fullName" value={formData.fullName} onChange={handleChange} className="form-input" placeholder="Tu nombre completo" required />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">Número de documento</label>
        <input name="documentNumber" value={formData.documentNumber} onChange={handleChange} className="form-input" placeholder="Tu número de documento" required />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">Fecha de nacimiento</label>
        <input
          name="birthDate"
          type="date"
          value={formData.birthDate}
          onChange={handleChange}
          className="form-input"
          max={adultBirthDateLimit}
          required
        />
        <p className="mt-1 text-xs text-slate-400">Debes tener al menos 18 años.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">Correo electrónico</label>
        <input name="email" type="email" value={formData.email} onChange={handleChange} className="form-input" placeholder="usuario@email.com" required />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">Usuario</label>
        <input name="username" value={formData.username} onChange={handleChange} className="form-input" placeholder="tuusuario" required />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">Contraseña</label>
        <input name="password" type="password" value={formData.password} onChange={handleChange} className="form-input" placeholder="••••••••" required />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">Confirmar contraseña</label>
        <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} className="form-input" placeholder="••••••••" required />
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 rounded border-white/10 bg-brand-input" />
        Acepto los términos y condiciones.
      </label>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <Button type="submit" className="w-full">Registrarme</Button>

      <p className="text-center text-sm text-slate-300">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-brand-gold">Inicia sesión</Link>
      </p>
    </form>
  );
}

export default RegisterForm;
