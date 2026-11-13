import BrandMark from '../components/ui/BrandMark';
import Panel from '../components/ui/Panel';
import ForgotPasswordForm from '../components/forms/ForgotPasswordForm';

function ForgotPasswordPage() {
  return (
    <div className="page-shell items-center justify-center px-4 py-10">
      <Panel tone="strong" className="w-full max-w-lg" innerClassName="p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-center">
          {/* Candado dibujado en SVG (sin emojis). */}
          <div className="cut flex h-20 w-20 items-center justify-center bg-gold/10 text-gold">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4.5" y="10.5" width="15" height="10" rx="1.5" />
              <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
              <path d="M12 14.5v2.5" />
            </svg>
          </div>
        </div>

        <div className="mb-6 text-center">
          <div className="mb-3 flex items-center justify-center">
            <BrandMark compact />
          </div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-[0.1em] text-ink sm:text-3xl">Recuperar contraseña</h1>
        </div>

        <p className="mb-6 text-center text-ink-muted">Ingresa tu correo electrónico para recibir instrucciones de recuperación.</p>

        <ForgotPasswordForm />
      </Panel>
    </div>
  );
}

export default ForgotPasswordPage;
