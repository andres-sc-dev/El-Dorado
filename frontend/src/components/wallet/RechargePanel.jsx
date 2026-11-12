import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApiData } from '../../hooks/useApiData';
import { getPaymentConfig, getPaymentStatus, loadWompiWidget, preparePayment } from '../../services/paymentService';
import { formatCOP } from '../../utils/format';
import Button from '../ui/Button';

// Recarga con Wompi Sandbox:
// 1. La API firma la recarga (POST /api/payments/prepare) y la guarda en Firestore como CREATED.
// 2. Se abre el Widget oficial con esos datos firmados.
// 3. Al terminar, se consulta GET /api/payments/:reference hasta APPROVED/CREDITED o DECLINED.
//    Ese endpoint pregunta a Wompi con la llave privada y acredita con fn_recargar.

const CHIPS = [10000, 50000, 100000, 500000];
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 20;   // ~1 minuto
const FINAL = ['CREDITED', 'DECLINED', 'ERROR', 'VOIDED'];
const PUBLIC_KEY = import.meta.env.VITE_WOMPI_PUBLIC_KEY || '';

function validateAmount(raw, config) {
  if (!config) return 'Cargando límites…';
  if (raw === '') return 'Escribe un monto.';
  if (!/^\d+$/.test(raw)) return 'Usa solo pesos enteros, sin puntos ni decimales.';
  const value = Number(raw);
  if (value < config.min_cop) return `El mínimo por recarga es ${formatCOP(config.min_cop)}.`;
  if (value > config.max_cop) return `El máximo por recarga es ${formatCOP(config.max_cop)}. Haz varias recargas o ingresa un monto menor.`;
  return null;
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

function RechargePanel({ highlighted, onCredited }) {
  const { refreshUser } = useAuth();
  const { data: config, error: configError } = useApiData(getPaymentConfig);
  const [amount, setAmount] = useState('50000');
  const [phase, setPhase] = useState('idle'); // idle | preparing | widget | processing | done
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const pending = useRef(null);
  const active = useRef(true);

  useEffect(() => () => { active.current = false; }, []);

  const amountError = validateAmount(amount, config);
  const limitsText = config ? `Mínimo ${formatCOP(config.min_cop)} · Máximo ${formatCOP(config.max_cop)} por recarga` : 'Mínimo $10.000 · Máximo $3.000.000 por recarga';
  const keyProblem = PUBLIC_KEY.startsWith('pub_prod_')
    ? 'La llave pública es de producción: este proyecto solo usa Wompi Sandbox.'
    : null;
  const notReady = config && !config.sandbox_ready
    ? 'Las recargas no están configuradas: faltan las llaves de Wompi Sandbox en el servidor.'
    : null;

  const poll = async (reference, transactionId) => {
    setPhase('processing');
    for (let attempt = 0; attempt < POLL_MAX_TRIES && active.current; attempt += 1) {
      try {
        const status = await getPaymentStatus(reference, transactionId);
        if (FINAL.includes(status.status)) {
          setResult(status);
          setPhase('done');
          if (status.status === 'CREDITED') {
            await refreshUser();
            onCredited?.();
          }
          return;
        }
      } catch (pollError) {
        if (pollError.status && pollError.status < 500) {
          setError(pollError.message);
          setPhase('idle');
          return;
        }
      }
      await sleep(POLL_INTERVAL_MS);
    }
    if (active.current) {
      setResult({ status: 'TIMEOUT', reference });
      setPhase('done');
    }
  };

  const startPayment = async () => {
    setError(null);
    setResult(null);
    setPhase('preparing');
    try {
      const [prepared, WidgetCheckout] = await Promise.all([preparePayment(Number(amount)), loadWompiWidget()]);
      pending.current = prepared.reference;
      const publicKey = PUBLIC_KEY || prepared.publicKey;
      const checkout = new WidgetCheckout({
        currency: prepared.currency,
        amountInCents: prepared.amountInCents,
        reference: prepared.reference,
        publicKey,
        signature: { integrity: prepared.signature },
      });
      setPhase('widget');
      // Wompi llama este callback cuando la transacción termina y entrega su id.
      checkout.open((widgetResult) => {
        poll(prepared.reference, widgetResult?.transaction?.id);
      });
    } catch (startError) {
      setError(startError.message || 'No se pudo iniciar la recarga.');
      setPhase('idle');
    }
  };

  const busy = phase === 'preparing' || phase === 'processing';
  const disabled = Boolean(amountError || keyProblem || notReady || configError) || busy;

  return (
    <section aria-labelledby="deposit-title" className={`glass-panel rounded-2xl p-5 ${highlighted ? 'ring-2 ring-brand-gold/60' : ''}`}>
      <h2 id="deposit-title" className="text-xl font-bold text-white">Recargar con Wompi</h2>

      <p className="mt-3 rounded-lg border border-brand-gold/50 bg-brand-gold/10 px-3 py-2 text-sm font-semibold text-amber-100">
        {limitsText}
      </p>

      <div className="mt-3 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-xs text-sky-100">
        <p className="font-semibold">Modo Sandbox: no se cobra dinero real.</p>
        <p>Tarjeta aprobada: <span className="font-mono">4242 4242 4242 4242</span></p>
        <p>Tarjeta declinada: <span className="font-mono">4111 1111 1111 1111</span></p>
        <p>Cualquier fecha futura y cualquier CVC de 3 dígitos.</p>
      </div>

      <label htmlFor="recharge-amount" className="mt-4 block text-xs uppercase tracking-[0.2em] text-slate-400">Monto (COP)</label>
      <input
        id="recharge-amount"
        inputMode="numeric"
        className="form-input mt-1"
        value={amount}
        onChange={(event) => setAmount(event.target.value.trim())}
        aria-invalid={Boolean(amountError)}
        aria-describedby="recharge-amount-error"
        disabled={busy}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={busy}
            onClick={() => setAmount(String(chip))}
            className={`rounded-full border px-3 py-1 text-sm ${Number(amount) === chip ? 'border-brand-gold bg-brand-gold/20 text-brand-gold' : 'border-white/15 text-slate-200 hover:border-brand-gold/60'}`}
          >
            {formatCOP(chip)}
          </button>
        ))}
      </div>
      <p id="recharge-amount-error" className="mt-2 min-h-[1.25rem] text-sm text-red-300">
        {amount !== '' && amountError && config ? amountError : ''}
      </p>

      {keyProblem || notReady || configError ? (
        <p role="alert" className="mt-2 text-sm text-red-300">{keyProblem || notReady || configError.message}</p>
      ) : null}

      <Button type="button" className="mt-2 w-full disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={startPayment}>
        {phase === 'preparing' ? 'Preparando…' : phase === 'processing' ? 'Procesando…' : `Recargar ${amountError ? '' : formatCOP(Number(amount))}`}
      </Button>

      {phase === 'widget' ? (
        <div className="mt-3 text-sm text-slate-300">
          <p>Completa el pago en la ventana de Wompi.</p>
          <button type="button" className="mt-1 font-semibold text-brand-gold" onClick={() => poll(pending.current)}>
            Ya pagué, verificar estado
          </button>
        </div>
      ) : null}

      {phase === 'processing' ? (
        <p role="status" className="mt-3 text-sm text-amber-100">Procesando… estamos confirmando el pago con Wompi.</p>
      ) : null}

      {phase === 'done' && result ? (
        <div
          role="status"
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${result.status === 'CREDITED'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
            : 'border-red-500/40 bg-red-500/10 text-red-100'}`}
        >
          {result.status === 'CREDITED' ? `Recarga aprobada: se acreditaron ${formatCOP(result.amount_cop)}. Nuevo saldo ${formatCOP(result.balance)}.` : null}
          {['DECLINED', 'ERROR', 'VOIDED'].includes(result.status) ? 'El pago fue rechazado. No se hizo ningún cargo a tu saldo.' : null}
          {result.status === 'TIMEOUT' ? (
            <>
              Wompi aún no confirma el pago.{' '}
              <button type="button" className="font-semibold underline" onClick={() => poll(result.reference)}>Verificar de nuevo</button>
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
    </section>
  );
}

export default RechargePanel;
