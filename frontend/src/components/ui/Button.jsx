function Button({ children, className = '', variant = 'primary', ...props }) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md px-4 py-2 font-semibold transition';
  const variantClasses =
    variant === 'secondary'
      ? 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
      : 'bg-gradient-to-r from-brand-gold to-brand-goldDeep text-slate-900 hover:brightness-110';

  return (
    <button className={`${baseClasses} ${variantClasses} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export default Button;
