import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DocumentInput from '../components/forms/DocumentInput';
import BrandMark from '../components/ui/BrandMark';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import { LoadingState } from '../components/ui/StatusStates';
import { useAuth } from '../context/AuthContext';
import {
  completeGoogleProfile, currentGoogleIdToken, currentGoogleProfile, signOutGoogle,
} from '../services/googleAuthService';

// Paso 2 del registro con Google: los datos que Google no entrega (documento, nacimiento, términos).
// El backend vuelve a verificar el idToken antes de crear nada.

const DOCUMENT_TYPES = [
  { code: 'CC', label: 'Cédula de ciudadanía', numeric: true },
  { code: 'CE', label: 'Cédula de extranjería', numeric: true },
  { code: 'PEP', label: 'Permiso especial de permanencia', numeric: true },
  { code: 'PA', label: 'Pasaporte', numeric: false },
];

function adultLimit() {
  const today = new Date();
  const limit = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
}

function CompleteProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSessionUser } = useAuth();
  const [profile, setProfile] = useState(location.state?.email ? location.state : null);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ documentType: 'CC', documentNumber: '', birthDate: '', acceptedTerms: false });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maxBirthDate = adultLimit();
  const documentType = DOCUMENT_TYPES.find((item) => item.code === form.documentType);

  // Debe seguir abierta la sesión de Google del paso anterior.
  useEffect(() => {
    let active = true;
    currentGoogleProfile()
      .then((googleProfile) => { if (active) setProfile(googleProfile ? { ...googleProfile, ...(location.state || {}) } : null); })
      .catch(() => { if (active) setProfile(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [location.state]);

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const errors = {};
    if (!form.documentNumber) errors.documentNumber = 'Escribe tu número de documento.';
    if (!form.birthDate) errors.birthDate = 'Escribe tu fecha de nacimiento.';
    else if (form.birthDate > maxBirthDate) errors.birthDate = 'Debes tener al menos 18 años.';
    if (!form.acceptedTerms) errors.acceptedTerms = 'Debes aceptar los términos y condiciones.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setIsSubmitting(true);
    try {
      const idToken = await currentGoogleIdToken();
      if (!idToken) {
        setError('Tu sesión de Google se cerró. Vuelve a iniciar sesión con Google.');
        return;
      }
      const result = await completeGoogleProfile({
        idToken,
        document_type: form.documentType,
        document_number: form.documentNumber,
        birth_date: form.birthDate,
        accepted_terms: form.acceptedTerms,
      });
      await signOutGoogle();
      setSessionUser(result.user);
      navigate('/', { replace: true });
    } catch (submitError) {
      // 400 trae la lista de campos; se muestra cada mensaje junto a su campo.
      const map = { document_type: 'documentType', document_number: 'documentNumber', birth_date: 'birthDate', accepted_terms: 'acceptedTerms' };
      const serverFields = submitError.data?.fields || [];
      if (serverFields.length) {
        setFieldErrors(Object.fromEntries(serverFields.map((item) => [map[item.field] || item.field, item.message])));
      }
      setError(submitError.message || 'No se pudo completar el registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  let content;
  if (checking) {
    content = <LoadingState message="Verificando tu sesión de Google…" />;
  } else if (!profile) {
    content = (
      <div className="text-center text-ink-muted">
        <p>No encontramos una sesión de Google activa.</p>
        <Link to="/login" className="mt-3 inline-flex min-h-[44px] items-center font-semibold text-gold hover:underline">Volver a iniciar sesión</Link>
      </div>
    );
  } else {
    content = (
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="cut-s bg-surface-2 px-3 py-2 text-sm text-ink-muted [overflow-wrap:anywhere]">
          Cuenta de Google: <span className="font-semibold text-ink">{profile.email}</span>
          {profile.name ? <><br />Nombre: <span className="text-ink">{profile.name}</span></> : null}
        </p>

        <div>
          <label htmlFor="documentType" className="eyebrow mb-1 block text-ink-muted">Tipo de documento</label>
          <select
            id="documentType"
            className="form-input"
            value={form.documentType}
            onChange={(event) => { update('documentType', event.target.value); update('documentNumber', ''); }}
          >
            {DOCUMENT_TYPES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="documentNumber" className="eyebrow mb-1 block text-ink-muted">Número de documento</label>
          {documentType.numeric ? (
            <DocumentInput
              value={form.documentNumber}
              onChange={(digits) => update('documentNumber', digits)}
              maxDigits={form.documentType === 'PEP' ? 15 : form.documentType === 'CE' ? 12 : 10}
              placeholder="1.234.567.890"
              aria-invalid={Boolean(fieldErrors.documentNumber)}
            />
          ) : (
            <input
              id="documentNumber"
              className="form-input"
              value={form.documentNumber}
              maxLength={20}
              onChange={(event) => update('documentNumber', event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="AB123456"
            />
          )}
          {fieldErrors.documentNumber ? <p className="mt-1 text-xs text-red-300">{fieldErrors.documentNumber}</p> : null}
          {fieldErrors.documentType ? <p className="mt-1 text-xs text-red-300">{fieldErrors.documentType}</p> : null}
        </div>

        <div>
          <label htmlFor="birthDate" className="eyebrow mb-1 block text-ink-muted">Fecha de nacimiento</label>
          <input id="birthDate" type="date" className="form-input" max={maxBirthDate} value={form.birthDate} onChange={(event) => update('birthDate', event.target.value)} />
          <p className="mt-1 text-xs text-ink-muted">Debes tener al menos 18 años.</p>
          {fieldErrors.birthDate ? <p className="mt-1 text-xs text-red-300">{fieldErrors.birthDate}</p> : null}
        </div>

        <label className="flex items-start gap-2 text-sm text-ink-muted">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-gold" checked={form.acceptedTerms} onChange={(event) => update('acceptedTerms', event.target.checked)} />
          Acepto los términos y condiciones y confirmo que soy mayor de 18 años.
        </label>
        {fieldErrors.acceptedTerms ? <p className="text-xs text-red-300">{fieldErrors.acceptedTerms}</p> : null}

        {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creando tu cuenta…' : 'Terminar registro'}
        </Button>
        <button type="button" className="min-h-[44px] w-full text-sm text-ink-muted hover:text-ink" onClick={async () => { await signOutGoogle(); navigate('/login'); }}>
          Cancelar
        </button>
      </form>
    );
  }

  return (
    <div className="page-shell items-center justify-center px-4 py-10">
      <Panel tone="strong" className="w-full max-w-md" innerClassName="p-6 sm:p-8">
        <div className="mb-6 flex justify-center"><BrandMark /></div>
        <h1 className="mb-2 text-center font-display text-2xl font-bold uppercase tracking-[0.1em] text-ink">Completa tu perfil</h1>
        <p className="mb-6 text-center text-sm text-ink-muted">Solo falta esto para crear tu cuenta de El Dorado.</p>
        {content}
      </Panel>
    </div>
  );
}

export default CompleteProfilePage;
