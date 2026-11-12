import { evaluatePassword } from '../../utils/passwordPolicy';

// Barra de 4 niveles (rojo, naranja, amarillo, verde) y el checklist de reglas.
// Cada regla lleva ícono y texto: el estado no depende solo del color.
const LEVELS = [
  { label: 'Escribe una contraseña', color: 'bg-slate-600', text: 'text-slate-400' },
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
          <div key={step} className={`h-1.5 flex-1 rounded-full ${result.level >= step ? level.color : 'bg-white/10'}`} />
        ))}
      </div>
      <p className={`mt-1 text-xs font-semibold ${level.text}`}>
        Seguridad: {level.label} ({result.level} de 4)
      </p>
      <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/30 p-3">
        <p className="mb-1 text-xs font-semibold text-slate-300">Tu contraseña debe tener:</p>
        <ul className="grid gap-1 text-xs sm:grid-cols-2">
          {result.rules.map((rule) => (
            <li key={rule.id} className={rule.ok ? 'text-emerald-300' : 'text-slate-400'}>
              <span aria-hidden="true">{rule.ok ? '✔' : '✖'}</span>{' '}
              {rule.label}
              <span className="sr-only">{rule.ok ? ' (cumplida)' : ' (pendiente)'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default PasswordStrengthBar;
