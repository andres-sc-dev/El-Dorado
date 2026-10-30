function OddButton({ label, value, onClick, active }) {
  const handleClick = (e) => {
    if (typeof onClick === 'function') onClick(e);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex min-w-[72px] flex-col items-center rounded-lg border px-2 py-2 text-left transition ${
        active
          ? 'border-brand-gold bg-brand-gold/20 text-brand-gold'
          : 'border-white/10 bg-brand-card text-slate-100 hover:border-brand-gold/70 hover:text-brand-gold'
      }`}
    >
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-base font-bold">{value.toFixed(2)}</span>
    </button>
  );
}

export default OddButton;
