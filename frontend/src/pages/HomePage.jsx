import { Link } from 'react-router-dom';
import BetSlip from '../components/betting/BetSlip';
import MatchCard from '../components/betting/MatchCard';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StatusStates';
import { useApiData } from '../hooks/useApiData';
import { getMatches } from '../services/matchService';
import { formatCOP } from '../utils/format';
import { getPromotions } from '../services/promotionService';

function HomePage() {
  const { user, isAdmin } = useAuth();
  const { data, error, isLoading, reload } = useApiData(getMatches);
  const promotions = useApiData(getPromotions);

  const featuredMatches = (data?.matches ?? []).filter((match) => match.is_betting_open).slice(0, 4);

  return (
    <div className="page-shell mockup-shell">
      <Navbar />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-6">
        <Sidebar />

        <main className="flex-1 space-y-8">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#091a2c] shadow-soft">
            <div
              className="stadium-hero flex flex-col gap-8 bg-cover bg-center p-8 lg:flex-row lg:items-end lg:justify-between"
              style={{
                backgroundImage: "linear-gradient(110deg, rgba(10, 22, 40, 0.8), rgba(10, 22, 40, 0.45)), url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=80')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="max-w-xl">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-brand-gold">Vuelve la época dorada</p>
                <h1 className="text-4xl font-black leading-tight text-white md:text-5xl">La pasión del fútbol colombiano, en cada jornada</h1>
                <p className="mt-4 max-w-lg text-slate-200">Apuesta en los partidos de la Primera División de Colombia y vive la intensidad de los clásicos, los derbies y el torneo más competitivo del país.</p>
                <div className="mt-6">
                  <Link to="/matches">
                    <Button type="button">Apuesta ahora</Button>
                  </Link>
                </div>
              </div>

              {user && !isAdmin ? (
                <div className="rounded-2xl border border-white/10 bg-slate-900/35 p-4 backdrop-blur-sm">
                  <p className="text-sm text-slate-300">Saldo disponible</p>
                  <p className="mt-2 text-3xl font-black text-brand-gold">{formatCOP(user.balance)}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">Saldo de prueba · proyecto académico</p>
                </div>
              ) : null}
            </div>
          </section>


          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Partidos destacados</h2>
                <Link to="/matches" className="text-sm font-semibold text-brand-gold">Ver todos</Link>
              </div>

              <div className="space-y-4">
                {isLoading ? <LoadingState message="Cargando partidos…" /> : null}
                {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
                {!isLoading && !error && featuredMatches.length === 0 ? (
                  <EmptyState title="No hay partidos abiertos" message="Vuelve pronto." />
                ) : null}
                {featuredMatches.map((match) => <MatchCard key={match.match_code} match={match} compact />)}
              </div>
            </section>

            <div className="xl:sticky xl:top-24 xl:self-start">
              <BetSlip limits={data?.limits} />
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Promociones</h2>
              <Link to="/promotions" className="text-sm font-semibold text-brand-gold">Ver todas</Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(promotions.data ?? []).map((promo) => (
                <div key={promo.id} className="glass-panel overflow-hidden rounded-2xl">
                  <img src={promo.imageUrl} alt={promo.title} className="h-36 w-full object-cover" />
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-white">{promo.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{promo.description}</p>
                    <Button type="button" className="mt-4 w-full">Ver promoción</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </div>
  );
}

export default HomePage;
