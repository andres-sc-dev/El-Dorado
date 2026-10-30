import BrandMark from '../components/ui/BrandMark';
import ForgotPasswordForm from '../components/forms/ForgotPasswordForm';

function ForgotPasswordPage() {
  return (
    <div className="page-shell mockup-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#091b2d]/80 p-8 shadow-soft">
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-brand-gold/50 bg-white/5 text-4xl text-brand-gold shadow-[0_0_25px_rgba(245,185,66,0.3)]">
            🔒
          </div>
        </div>

        <div className="mb-6 text-center">
          <div className="mb-3 flex items-center justify-center">
            <BrandMark compact />
          </div>
          <h1 className="text-3xl font-black text-white">RECUPERAR CONTRASEÑA</h1>
        </div>

        <p className="mb-6 text-center text-slate-300">Ingresa tu correo electrónico para recibir instrucciones de recuperación.</p>

        <ForgotPasswordForm />
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
