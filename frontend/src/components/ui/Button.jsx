function Button({ children, className = '', variant = 'primary', ...props }) {
  const baseClasses = 'cut-s inline-flex min-h-[44px] items-center justify-center px-4 py-2 font-display text-sm font-bold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-50';
  const variantClasses =
    variant === 'secondary'
      ? 'bg-surface-2 text-ink shadow-[inset_0_0_0_1px_theme(colors.line.strong)] hover:text-gold'
      : 'bg-gold text-night hover:brightness-110';

  return (
    <button className={`${baseClasses} ${variantClasses} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export default Button;
