import { Link } from 'react-router-dom';
import BetSlip from '../components/betting/BetSlip';
import MatchCard from '../components/betting/MatchCard';
import OddButton from '../components/betting/OddButton';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import Panel from '../components/ui/Panel';
import TeamShield from '../components/ui/TeamShield';
import { useAuth } from '../context/AuthContext';
import { useBetSlip } from '../context/BetSlipContext';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatusStates';
import { useApiData } from '../hooks/useApiData';
import { getMatches } from '../services/matchService';
import { formatDateTime } from '../utils/format';

// Encabezado de cada grupo de partidos: "viernes, 13 de noviembre".
function dayLabel(value) {
  return new Date(value).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Agrupa por día los partidos que ya llegaron (la API los entrega ordenados por fecha).
function groupByDay(matches) {
  const groups = [];
  matches.forEach((match) => {
    const label = dayLabel(match.match_date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.matches.push(match);
    else groups.push({ label, matches: [match] });
  });
  return groups;
}

// Próximo partido destacado con sus 3 cuotas 1 X 2. Usa la misma selección del cupón que MatchCard.
function FeaturedMatch({ match }) {
  const { isAdmin } = useAuth();
  const { selection, select } = useBetSlip();
  const market = match.markets[0];

  const isSelected = (outcome) => selection
    && selection.matchCode === match.match_code
    && selection.marketCode === market.market_code
    && selection.outcomeCode === outcome.outcome_code
    && selection.line === outcome.line;

  const choose = (outcome) => select({
    matchCode: match.match_code,
    matchLabel: `${match.home_team.short_name} vs ${match.away_team.short_name}`,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    marketCode: market.market_code,
    marketName: market.name,
    outcomeCode: outcome.outcome_code,
    outcomeName: outcome.name,
    line: outcome.line,
    oddValue: outcome.odd_value,
  });

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
      <div>
        <p className="eyebrow text-steel">Próximo partido · Jornada {match.matchday}</p>
        <p className="mt-1 font-mono text-xs text-ink-muted sm:hidden">{formatDateTime(match.match_date)}</p>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
          <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
            <TeamShield team={match.home_team} size="lg" />
            <span className="max-w-full font-display text-xs font-bold uppercase tracking-[0.06em] text-ink [overflow-wrap:anywhere] sm:text-lg">{match.home_team.name}</span>
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-bold text-gold">VS</p>
            <p className="hidden font-mono text-xs text-ink-muted sm:block">{formatDateTime(match.match_date)}</p>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row-reverse sm:text-right">
            <TeamShield team={match.away_team} size="lg" />
            <span className="max-w-full font-display text-xs font-bold uppercase tracking-[0.06em] text-ink [overflow-wrap:anywhere] sm:text-lg">{match.away_team.name}</span>
          </div>
        </div>
      </div>
      <div>
        <p className="eyebrow mb-2 text-ink-muted">{market.name}</p>
        <div className="grid grid-cols-3 gap-2">
          {market.outcomes.map((outcome) => (
            <OddButton
              key={outcome.outcome_code}
              label={outcome.name}
              value={outcome.odd_value}
              active={isSelected(outcome)}
              disabled={isAdmin}
              onClick={() => choose(outcome)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  const { data, error, isLoading, reload } = useApiData(getMatches);

  const openMatches = (data?.matches ?? []).filter((match) => match.is_betting_open);
  const nextMatch = openMatches.find((match) => match.markets.length > 0);
  const featuredMatches = openMatches.slice(0, 8);
  const groups = groupByDay(featuredMatches);

  return (
    <div className="page-shell">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 lg:px-6">
        <Panel as="section" tone="strong" aria-labelledby="hero-title" innerClassName="hero-glow p-5 sm:p-8">
          <p className="eyebrow text-gold">Liga BetPlay</p>
          <h1 id="hero-title" className="mt-2 font-display text-3xl font-bold uppercase leading-tight tracking-[0.06em] text-ink sm:text-5xl">
            Vuelve la época <span className="text-gold">dorada</span>
          </h1>
          {nextMatch ? <FeaturedMatch match={nextMatch} /> : null}
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4" aria-labelledby="featured-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="featured-title" className="font-display text-lg sm:text-xl font-bold uppercase tracking-[0.12em] text-ink">Partidos destacados</h2>
              <Link to="/matches" className="flex min-h-[44px] shrink-0 items-center whitespace-nowrap font-display text-xs font-bold uppercase tracking-[0.16em] text-gold hover:text-ink">
                Ver todos
              </Link>
            </div>

            {isLoading ? <LoadingState message="Cargando partidos…" /> : null}
            {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
            {!isLoading && !error && featuredMatches.length === 0 ? (
              <EmptyState title="No hay partidos abiertos" message="Vuelve pronto." />
            ) : null}

            {groups.length > 0 ? (
              <Panel innerClassName="divide-y divide-line">
                {groups.map((group) => (
                  <div key={group.label} className="divide-y divide-line/60">
                    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-3 bg-surface-2/70 px-3 py-2 md:grid-cols-[minmax(0,1fr)_264px] md:px-4">
                      <h3 className="eyebrow text-steel">{group.label}</h3>
                      <div className="hidden grid-cols-3 gap-2 text-center font-mono text-xs font-bold text-ink-muted md:grid" aria-hidden="true">
                        <span>1</span><span>X</span><span>2</span>
                      </div>
                    </div>
                    {group.matches.map((match) => <MatchCard key={match.match_code} match={match} compact />)}
                  </div>
                ))}
              </Panel>
            ) : null}
          </section>

          {/* En móvil el cupón se abre desde la barra inferior (MobileBetSlipBar). */}
          <div className="hidden xl:sticky xl:top-28 xl:block xl:self-start">
            <BetSlip limits={data?.limits} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;
