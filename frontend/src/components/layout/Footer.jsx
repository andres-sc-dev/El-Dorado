function Footer() {
  return (
    <footer className="border-t border-white/10 bg-brand-navyAlt/70 py-6 text-sm text-slate-400">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center lg:flex-row lg:text-left">
        <div>
          <p className="font-semibold text-white">El Dorado © 2026</p>
          <p>Vuelve la época dorada</p>
          <p className="mt-2 inline-block rounded-md border border-red-400/50 px-2 py-0.5 text-xs font-bold text-red-200">Mayores de 18 años</p>
          <p className="mt-1 text-xs text-slate-400">Proyecto académico: dinero de prueba, sin valor real.</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-4 lg:justify-end">
          <a href="#ayuda" className="transition hover:text-white">Ayuda</a>
          <a href="#contacto" className="transition hover:text-white">Contacto</a>
          <a href="#terminos" className="transition hover:text-white">Términos y condiciones</a>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
