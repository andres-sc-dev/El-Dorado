import BetSlip from '../components/betting/BetSlip';
import MatchCard from '../components/betting/MatchCard';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatusStates';
import { useApiData } from '../hooks/useApiData';
import { getMatches } from '../services/matchService';

function MatchesPage() {
  const { data, error, isLoading, reload } = useApiData(getMatches);
  const matches = data?.matches ?? [];
  const open = matches.filter((match) => match.is_betting_open);
  const closed = matches.filter((match) => !match.is_betting_open);

  let content;
  if (isLoading) content = <LoadingState message="Cargando partidos…" />;
  else if (error) content = <ErrorState message={error.message} onRetry={reload} />;
  else if (matches.length === 0) content = <EmptyState title="No hay partidos" message="Todavía no hay partidos cargados." />;
  else {
    content = (
      <>
        {open.length === 0 ? (
          <EmptyState title="No hay partidos abiertos" message="Vuelve pronto: aún no hay partidos programados para apostar." />
        ) : open.map((match) => <MatchCard key={match.match_code} match={match} />)}
        {closed.length > 0 ? (
          <>
            <h2 className="pt-4 text-xl font-bold text-white">Partidos cerrados</h2>
            {closed.map((match) => <MatchCard key={match.match_code} match={match} />)}
          </>
        ) : null}
      </>
    );
  }

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-brand-gold">Liga BetPlay Dimayor</p>
          <h1 className="text-3xl font-black text-white">Partidos de Colombia</h1>
          {data?.degraded?.length ? (
            <p className="mt-2 text-sm text-amber-200">Algunos nombres no están disponibles por ahora; se muestran los códigos.</p>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">{content}</div>
          <div className="xl:sticky xl:top-24 xl:self-start">
            <BetSlip limits={data?.limits} />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default MatchesPage;
