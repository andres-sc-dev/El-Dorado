import { evaluatePassword } from '../../utils/passwordPolicy';

// Barra de 4 niveles (rojo, naranja, amarillo, verde) y el checklist de reglas.
// Cada regla lleva ícono y texto: el estado no depende solo del color.
const LEVELS = [
  { label: 'Escribe una contraseña', color: 'bg-line-strong', text: 'text-ink-muted' },
  { label: 'Muy débil', color: 'bg-red-500', text: 'text-red-300' },
  { label: 'Débil', color: 'bg-orange-500', text: 'text-orange-300' },
  { label: 'Casi lista', color: 'bg-yellow-400', text: 'text-yellow-200' },
  { label: 'Fuerte', color: 'bg-emerald-500', text: 'text-emerald-300' },
];

function PasswordStrengthBar({ password, username, email }) {
  const result = evaluatePassword(password, { username, email });
  const level = LEVELS[result.level];

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className={`h-1.5 flex-1 rounded-full ${result.level >= step ? level.color : 'bg-line'}`} />
        ))}
      </div>
      <p className={`mt-1 text-xs font-semibold ${level.text}`}>
        Seguridad: {level.label} ({result.level} de 4)
      </p>
      <div className="cut-s mt-2 bg-surface-2 p-3">
        <p className="mb-1 text-xs font-semibold text-ink-muted">Tu contraseña debe tener:</p>
        <ul className="grid gap-1 text-xs sm:grid-cols-2">
          {result.rules.map((rule) => (
            <li key={rule.id} className={`flex items-start gap-1.5 ${rule.ok ? 'text-emerald-300' : 'text-ink-muted'}`}>
              <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" className="mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {rule.ok ? <path d="M3 8.5 6.5 12 13 4.5" /> : <path d="M4 4l8 8M12 4l-8 8" />}
              </svg>
              <span>
                {rule.label}
                <span className="sr-only">{rule.ok ? ' (cumplida)' : ' (pendiente)'}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default PasswordStrengthBar;
