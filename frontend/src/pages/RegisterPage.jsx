import BrandMark from '../components/ui/BrandMark';
import RegisterForm from '../components/forms/RegisterForm';

function RegisterPage() {
  return (
    <div className="page-shell mockup-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#091b2d]/80 shadow-soft lg:grid-cols-2">
        <div
          className="stadium-side-panel relative hidden min-h-[700px] bg-cover bg-center lg:block"
          style={{
            backgroundImage: "linear-gradient(135deg, rgba(8, 15, 29, 0.7), rgba(7, 18, 32, 0.5)), url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-brand-navy/35 via-brand-navy/20 to-brand-navy/75" />
        </div>

        <div className="flex items-center justify-center bg-[#071822] p-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-center">
              <BrandMark />
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-3xl font-black text-white">CREA TU CUENTA</h1>
            </div>

            <RegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
