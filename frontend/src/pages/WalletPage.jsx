import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import Footer from '../components/layout/Footer';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { createBalanceMovement } from '../services/authService';

function WalletPage() {
  const location = useLocation();
  const { user, updateUser } = useAuth();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const hasDepositTab = useMemo(
    () => new URLSearchParams(location.search).get('tab') === 'deposit',
    [location.search],
  );
  const availableBalance = Number(user?.balance ?? 0) + Number(user?.bonusBalance ?? 0);

  const handleDeposit = async (event) => {
    event.preventDefault();

    const amount = Number(depositAmount);

    if (!user) {
      setFeedback({ type: 'error', message: 'Debes iniciar sesión para depositar.' });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedback({ type: 'error', message: 'Ingresa un monto válido para depositar.' });
      return;
    }

    try {
      const nextBalance = await createBalanceMovement('deposit', amount);
      updateUser({ balance: nextBalance });
      setFeedback({ type: 'success', message: `Depósito exitoso: $ ${amount.toLocaleString('es-CO')} agregado a tu saldo disponible.` });
      setDepositAmount('');
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  };

  const handleWithdraw = async (event) => {
    event.preventDefault();

    const amount = Number(withdrawAmount);

    if (!user) {
      setFeedback({ type: 'error', message: 'Debes iniciar sesión para retirar.' });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedback({ type: 'error', message: 'Ingresa un monto válido para retirar.' });
      return;
    }

    if (amount > availableBalance) {
      setFeedback({ type: 'error', message: 'No puedes retirar más de lo disponible en tu saldo y bono.' });
      return;
    }

    try {
      const nextBalance = await createBalanceMovement('withdraw', amount);
      updateUser({ balance: nextBalance });
      setFeedback({ type: 'success', message: `Retiro solicitado: $ ${amount.toLocaleString('es-CO')} se descontó del saldo disponible.` });
      setWithdrawAmount('');
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    }
  };

  return (
    <div className="page-shell">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
        <h1 className="mb-8 text-3xl font-black text-white">Depósitos y retiros</h1>

        {feedback.message && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <form onSubmit={handleDeposit} className={`glass-panel rounded-2xl p-5 ${hasDepositTab ? 'ring-2 ring-brand-gold/60' : ''}`}>
            <h2 className="text-xl font-bold text-white">Depositar</h2>
            <div className="mt-4 space-y-4">
              <input
                className="form-input"
                type="number"
                min="1"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                placeholder="Monto"
              />
              <Button type="submit" className="w-full">Confirmar depósito</Button>
            </div>
          </form>

          <form onSubmit={handleWithdraw} className="glass-panel rounded-2xl p-5">
            <h2 className="text-xl font-bold text-white">Retirar</h2>
            <div className="mt-4 space-y-4">
              <input
                className="form-input"
                type="number"
                min="1"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                placeholder="Monto"
              />
              <Button type="submit" variant="secondary" className="w-full">Solicitar retiro</Button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default WalletPage;
