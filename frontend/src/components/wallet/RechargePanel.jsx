import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApiData } from '../../hooks/useApiData';
import {
  getPaymentConfig, getPaymentStatus, loadWompiWidget, preparePayment, verifyTransaction,
} from '../../services/paymentService';
import { formatCOP } from '../../utils/format';
import Button from '../ui/Button';
import Panel from '../ui/Panel';

// Recarga con Wompi Sandbox:
// 1. La API firma la recarga (POST /api/payments/prepare) y la guarda en Firestore como CREATED.
// 2. Se abre el Widget oficial con esos datos firmados, SIN redirect-url: con una redirect-url
//    a localhost, checkout.wompi.co responde 403 y el Widget no abre (comprobado el 12-nov-2026).
// 3. El resultado se verifica SIEMPRE con el backend:
//    - con el id que entrega el callback del Widget (result.transaction.id): se consulta hasta
//      un estado final o hasta el tope;
//    - sin id: una consulta por reference; si aún no hay decisión, se muestra
//      "Todavía no recibimos la confirmación de Wompi" con "Verificar de nuevo".
//    Si algún día hay una redirect-url pública, el ?id= que agrega Wompi también se verifica al volver.
//    La pantalla termina siempre en "Pago aprobado", "Pago rechazado" o "Todavía no recibimos la confirmación".

const CHIPS = [10000, 50000, 100000, 500000];
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TRIES = 20;   // ~1 minuto
const FINAL = ['CREDITED', 'DECLINED', 'ERROR', 'VOIDED'];
const REJECTED = ['DECLINED', 'ERROR', 'VOIDED'];
const PUBLIC_KEY = import.meta.env.VITE_WOMPI_PUBLIC_KEY || '';
const PENDING_KEY = 'eldorado.pendingRecharge';

// sessionStorage puede fallar (modo privado, almacenamiento bloqueado): nunca rompe el flujo.
const pendingStore = {
  get() { try { return sessionStorage.getItem(PENDING_KEY); } catch { return null; } },
  set(reference) { try { sessionStorage.setItem(PENDING_KEY, reference); } catch { /* sin almacenamiento */ } },
  clear() { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* sin almacenamiento */ } },
};

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
  const location = useLocation();
  const navigate = useNavigate();
  const { data: config, error: configError } = useApiData(getPaymentConfig);
  const [amount, setAmount] = useState('50000');
  const [phase, setPhase] = useState('idle'); // idle | preparing | widget | processing | done
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const pendingReference = useRef(null);
  // mounted se vuelve a poner en true en cada montaje: en desarrollo, StrictMode monta,
  // desmonta y vuelve a montar, y un ref que solo se apaga dejaba la consulta muerta.
  const mounted = useRef(false);
  // Cada verificación tiene un número; si empieza otra, la anterior se detiene.
  const pollRun = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const finish = useCallback(async (status) => {
    setResult(status);
    setPhase('done');
    if (FINAL.includes(status.status)) {
      pendingStore.clear();
      if (status.status === 'CREDITED') {
        await refreshUser();
        onCredited?.();
      }
    }
  }, [refreshUser, onCredited]);

  // check() consulta una vez al backend; se repite hasta un estado final o hasta el tope.
  // Con id de transacción se insiste hasta POLL_MAX_TRIES; sin id, una sola consulta por reference.
  const verify = useCallback(async ({ reference, transactionId }) => {
    const maxTries = transactionId ? POLL_MAX_TRIES : 1;
    const run = pollRun.current + 1;
    pollRun.current = run;
    setError(null);
    setResult(null);
    setPhase('processing');
    const check = () => (reference
      ? getPaymentStatus(reference, transactionId)
      : verifyTransaction(transactionId));

    let last = { status: 'PENDING', reference };
    for (let attempt = 0; attempt < maxTries; attempt += 1) {
      if (attempt > 0) await sleep(POLL_INTERVAL_MS);
      if (!mounted.current || pollRun.current !== run) return;
      try {
        last = await check();
        if (FINAL.includes(last.status)) {
          if (mounted.current && pollRun.current === run) await finish(last);
          return;
        }
      } catch (checkError) {
        // 4xx: no tiene sentido reintentar (no existe, no es tuya, id inválido).
        if (checkError.status && checkError.status < 500) {
          if (mounted.current && pollRun.current === run) {
            setError(checkError.message);
            setPhase('idle');
          }
          return;
        }
        // 0 o 5xx (red, Wompi o una base caída): se reintenta hasta el tope.
      }
    }
    if (mounted.current && pollRun.current === run) {
      await finish({ ...last, status: 'TIMEOUT', reference: last.reference ?? reference, transactionId });
    }
  }, [finish]);

  // Al llegar a /wallet: (a) ?id= de la redirect-url, o una recarga pendiente de esta pestaña.
  const handledUrl = useRef(false);
  useEffect(() => {
    if (handledUrl.current) return;
    handledUrl.current = true;
    const params = new URLSearchParams(location.search);
    const transactionId = params.get('id');
    const reference = pendingStore.get();
    if (transactionId) {
      // Se quita ?id= de la barra para que recargar la página no repita la verificación.
      params.delete('id');
      params.delete('env');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : '' }, { replace: true });
      verify({ reference, transactionId });
    } else if (reference) {
      verify({ reference });
    }
  }, [location.pathname, location.search, navigate, verify]);

  const amountError = validateAmount(amount, config);
  const limitsText = config
    ? `Mínimo ${formatCOP(config.min_cop)} · Máximo ${formatCOP(config.max_cop)} por recarga`
    : 'Mínimo $10.000 · Máximo $3.000.000 por recarga';
  const keyProblem = PUBLIC_KEY.startsWith('pub_prod_')
    ? 'La llave pública es de producción: este proyecto solo usa Wompi Sandbox.'
    : null;
  const notReady = config && !config.sandbox_ready
    ? 'Las recargas no están configuradas: faltan las llaves de Wompi Sandbox en el servidor.'
    : null;

  const startPayment = async () => {
    setError(null);
    setResult(null);
    setPhase('preparing');
    try {
      const [prepared, WidgetCheckout] = await Promise.all([preparePayment(Number(amount)), loadWompiWidget()]);
      pendingReference.current = prepared.reference;
      pendingStore.set(prepared.reference);
      const checkout = new WidgetCheckout({
        currency: prepared.currency,
        amountInCents: prepared.amountInCents,
        reference: prepared.reference,
        publicKey: PUBLIC_KEY || prepared.publicKey,
        signature: { integrity: prepared.signature },
        // Sin redirectUrl a propósito: con localhost, checkout.wompi.co responde 403.
      });
      setPhase('widget');
      // Wompi llama este callback cuando la transacción termina.
      checkout.open((widgetResult) => {
        verify({ reference: prepared.reference, transactionId: widgetResult?.transaction?.id });
      });
    } catch (startError) {
      setError(startError.message || 'No se pudo iniciar la recarga.');
      setPhase('idle');
    }
  };

  const busy = phase === 'preparing' || phase === 'processing';
  const disabled = Boolean(amountError || keyProblem || notReady || configError) || busy;

  return (
    <Panel as="section" aria-labelledby="deposit-title" tone={highlighted ? 'gold' : 'line'} innerClassName="p-5">
      <h2 id="deposit-title" className="font-display text-xl font-bold uppercase tracking-[0.1em] text-ink">Recargar con Wompi</h2>

      <p className="cut-s mt-3 bg-gold/10 px-3 py-2 font-mono text-sm font-semibold text-amber-100">
        {limitsText}
      </p>

      <div className="mt-3 border-l-2 border-steel bg-steel/10 px-3 py-2 text-xs text-ink">
        <p className="font-semibold">Modo Sandbox: no se cobra dinero real.</p>
        <p>Tarjeta aprobada: <span className="font-mono">4242 4242 4242 4242</span></p>
        <p>Tarjeta declinada: <span className="font-mono">4111 1111 1111 1111</span></p>
        <p>Cualquier fecha futura y cualquier CVC de 3 dígitos.</p>
      </div>

      <label htmlFor="recharge-amount" className="eyebrow mt-4 block text-ink-muted">Monto (COP)</label>
      <input
        id="recharge-amount"
        inputMode="numeric"
        className="form-input mt-1 font-mono"
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
            className={`cut-s min-h-[44px] px-3 font-mono text-sm font-semibold transition disabled:opacity-50 ${Number(amount) === chip ? 'bg-gold text-night' : 'bg-surface-2 text-gold hover:bg-line-strong'}`}
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

      <Button type="button" className="mt-2 w-full" disabled={disabled} onClick={startPayment}>
        {phase === 'preparing' ? 'Preparando…' : phase === 'processing' ? 'Procesando…' : `Recargar ${amountError ? '' : formatCOP(Number(amount))}`}
      </Button>

      {phase === 'widget' ? (
        <div className="mt-3 text-sm text-ink-muted">
          <p>Completa el pago en la ventana de Wompi.</p>
          <button type="button" className="mt-1 min-h-[44px] font-display text-xs font-bold uppercase tracking-[0.14em] text-gold hover:text-ink" onClick={() => verify({ reference: pendingReference.current })}>
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
          className={`mt-3 border-l-2 px-3 py-2 text-sm ${result.status === 'CREDITED'
            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
            : result.status === 'TIMEOUT'
              ? 'border-amber-400 bg-amber-400/10 text-amber-100'
              : 'border-red-400 bg-red-500/10 text-red-100'}`}
        >
          {result.status === 'CREDITED' ? (
            <>
              <p className="font-bold">Pago aprobado</p>
              <p>Se acreditaron {formatCOP(result.amount_cop)}. Nuevo saldo {formatCOP(result.balance)}.</p>
            </>
          ) : null}
          {REJECTED.includes(result.status) ? (
            <>
              <p className="font-bold">Pago rechazado</p>
              <p>Wompi no aprobó el pago. No se hizo ningún cambio a tu saldo.</p>
            </>
          ) : null}
          {result.status === 'TIMEOUT' ? (
            <>
              <p className="font-bold">Todavía no recibimos la confirmación de Wompi</p>
              <p>Si ya pagaste, el saldo se acreditará en cuanto Wompi confirme.</p>
              <button
                type="button"
                className="cut-s mt-2 min-h-[44px] bg-amber-400/15 px-3 font-display text-xs font-bold uppercase tracking-[0.14em] hover:bg-amber-400/25"
                onClick={() => verify({ reference: result.reference, transactionId: result.transactionId })}
              >
                Verificar de nuevo
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
    </Panel>
  );
}

export default RechargePanel;
