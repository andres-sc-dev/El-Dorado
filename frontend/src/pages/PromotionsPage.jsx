import { useEffect, useState } from 'react';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { getPromotions } from '../services/promotionService';

function PromotionsPage() {
  const { user, claimBonus } = useAuth();
  const [promotions, setPromotions] = useState([]);

  useEffect(() => {
    getPromotions().then(setPromotions);
  }, []);

  const handleClaim = (promo) => {
    if (!user) {
      return;
    }

    const bonusValue = promo.id === 'p1' ? 200000 : promo.id === 'p2' ? 50000 : 30000;
    claimBonus(promo.id, bonusValue);
  };

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <h1 className="mb-8 text-3xl font-black text-white">Promociones</h1>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {promotions.map((promo) => {
            const claimed = user?.claimedBonuses?.includes(promo.id);

            return (
              <div key={promo.id} className="glass-panel overflow-hidden rounded-2xl">
                <img src={promo.imageUrl} alt={promo.title} className="h-44 w-full object-cover" />
                <div className="p-4">
                  <h2 className="text-xl font-bold text-white">{promo.title}</h2>
                  <p className="mt-2 text-sm text-slate-300">{promo.description}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-brand-gold">Válido hasta {new Date(promo.validUntil).toLocaleDateString('es-CO')}</p>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    variant="secondary"
                    onClick={() => handleClaim(promo)}
                    disabled={!user || claimed}
                  >
                    {claimed ? 'Bono activado' : 'Canjear bono'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default PromotionsPage;
