function OddButton({ label, value, onClick, active, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={Boolean(active)}
      className={`flex min-w-[76px] flex-col items-center rounded-lg border px-2 py-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-brand-gold bg-brand-gold/20 text-brand-gold'
          : 'border-white/10 bg-brand-card text-slate-100 hover:border-brand-gold/70 hover:text-brand-gold'
      }`}
    >
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-base font-bold">{Number(value).toFixed(2)}</span>
    </button>
  );
}

export default OddButton;
