// Estados comunes de carga, vacío y error para las pantallas que leen la API.

export function LoadingState({ message = 'Cargando…' }) {
  return (
    <div role="status" className="glass-panel rounded-2xl p-8 text-center text-slate-300">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
      {message}
    </div>
  );
}

export function EmptyState({ title, message }) {
  return (
    <div className="glass-panel rounded-2xl p-8 text-center text-slate-300">
      <p className="text-lg font-semibold text-white">{title}</p>
      {message ? <p className="mt-2">{message}</p> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center text-red-100">
      <p className="font-semibold">{message || 'Algo salió mal.'}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-red-300/40 px-3 py-1 text-sm hover:bg-red-500/20">
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
