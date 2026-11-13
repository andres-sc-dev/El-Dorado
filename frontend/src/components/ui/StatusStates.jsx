// Estados comunes de carga, vacío y error para las pantallas que leen la API.
import Panel from './Panel';

export function LoadingState({ message = 'Cargando…' }) {
  return (
    <Panel role="status" innerClassName="p-8 text-center text-ink-muted">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      {message}
    </Panel>
  );
}

export function EmptyState({ title, message }) {
  return (
    <Panel innerClassName="p-8 text-center text-ink-muted">
      <p className="font-display text-lg font-bold uppercase tracking-[0.12em] text-ink">{title}</p>
      {message ? <p className="mt-2">{message}</p> : null}
    </Panel>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Panel role="alert" tone="danger" innerClassName="p-6 text-center text-red-100">
      <p className="font-semibold">{message || 'Algo salió mal.'}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="cut-s mt-3 min-h-[44px] bg-red-500/15 px-4 font-display text-sm font-semibold uppercase tracking-[0.12em] hover:bg-red-500/25"
        >
          Reintentar
        </button>
      ) : null}
    </Panel>
  );
}
