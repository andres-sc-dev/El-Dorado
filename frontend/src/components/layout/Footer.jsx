function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface/80 py-6 text-sm text-ink-muted">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center lg:flex-row lg:px-6 lg:text-left">
        <div>
          <p className="font-display font-bold uppercase tracking-[0.2em] text-ink">El <span className="text-gold">Dorado</span> © 2026</p>
          <p>Vuelve la época dorada</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <p className="cut-s bg-red-500/15 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-[0.16em] text-red-200">Mayores de 18 años</p>
            <p className="text-xs">Proyecto académico: dinero de prueba, sin valor real.</p>
          </div>
        </div>
        <nav aria-label="Enlaces del pie" className="flex flex-wrap items-center justify-center gap-x-2 lg:justify-end">
          <a href="#ayuda" className="flex min-h-[44px] items-center px-2 transition hover:text-ink">Ayuda</a>
          <a href="#contacto" className="flex min-h-[44px] items-center px-2 transition hover:text-ink">Contacto</a>
          <a href="#terminos" className="flex min-h-[44px] items-center px-2 transition hover:text-ink">Términos y condiciones</a>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
