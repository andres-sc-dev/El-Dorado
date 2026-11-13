import BrandMark from '../components/ui/BrandMark';
import Panel from '../components/ui/Panel';
import RegisterForm from '../components/forms/RegisterForm';

function RegisterPage() {
  return (
    <div className="page-shell items-center justify-center px-4 py-10">
      <Panel tone="strong" className="w-full max-w-5xl" innerClassName="grid lg:grid-cols-2">
        <div className="auth-art relative hidden min-h-[700px] border-r border-line lg:flex lg:items-end lg:p-8" aria-hidden="true">
          <p className="font-display text-2xl font-bold uppercase tracking-[0.12em] text-ink">
            Vuelve la época <span className="text-gold">dorada</span>
          </p>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-center">
              <BrandMark />
            </div>

            <div className="mb-6 text-center">
              <h1 className="font-display text-3xl font-bold uppercase tracking-[0.1em] text-ink">Crea tu cuenta</h1>
            </div>

            <RegisterForm />
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default RegisterPage;
