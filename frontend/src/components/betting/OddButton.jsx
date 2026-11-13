// Cuota: sin seleccionar, fondo superficie 2 y cifra dorada; seleccionada, fondo dorado con
// resplandor. El resplandor va en el contenedor externo porque el clip-path del botón lo recortaría.
function OddButton({ label, value, onClick, active, disabled }) {
  return (
    <span className={`block min-w-[76px] flex-1 ${active ? 'drop-shadow-glow' : ''}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={Boolean(active)}
        className={`cut-s flex min-h-[44px] w-full flex-col items-center justify-center px-2 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
          active
            ? 'bg-gold text-night'
            : 'bg-surface-2 text-gold hover:bg-line-strong'
        }`}
      >
        <span className={`font-display text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] ${active ? 'text-night' : 'text-ink-muted'}`}>
          {label}
        </span>
        <span className="font-mono text-base font-bold leading-tight">{Number(value).toFixed(2)}</span>
      </button>
    </span>
  );
}

export default OddButton;
