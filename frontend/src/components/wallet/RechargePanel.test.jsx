// Pruebas del panel de recarga dentro de <StrictMode>, como corre la app en desarrollo.
// Reproducen el bug del 12 de noviembre: tras el pago, el panel se quedaba en "Procesando…"
// sin consultar nunca al backend.
//   npm test
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RechargePanel from './RechargePanel';
import * as payments from '../../services/paymentService';

vi.mock('../../services/paymentService', () => ({
  getPaymentConfig: vi.fn(),
  preparePayment: vi.fn(),
  getPaymentStatus: vi.fn(),
  verifyTransaction: vi.fn(),
  loadWompiWidget: vi.fn(),
}));

const refreshUser = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ refreshUser }) }));

const REFERENCE = 'ELD-11111111-2222-4333-8444-555555555555';
const credited = { reference: REFERENCE, status: 'CREDITED', amount_cop: 50000, balance: 150000 };
let widget;

function renderPanel(url = '/wallet') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[url]}>
        <RechargePanel />
      </MemoryRouter>
    </StrictMode>,
  );
}

// Deja correr las promesas pendientes (y los temporizadores falsos, si los hay).
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  sessionStorage.clear();
  widget = null;
  payments.getPaymentConfig.mockResolvedValue({ min_cop: 10000, max_cop: 3000000, currency: 'COP', sandbox_ready: true });
  payments.preparePayment.mockResolvedValue({
    reference: REFERENCE, amountInCents: 5000000, currency: 'COP', signature: 'f'.repeat(64), publicKey: 'pub_test_x',
  });
  payments.loadWompiWidget.mockResolvedValue(class FakeWidget {
    constructor(options) { widget = { options, callback: null }; }
    open(callback) { widget.callback = callback; }
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function payWithWidget() {
  renderPanel();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: /Recargar/ }));
  await flush();
  expect(widget).not.toBeNull();
}

describe('RechargePanel', () => {
  it('camino b: el id del callback del Widget se verifica con el backend y muestra "Pago aprobado"', async () => {
    payments.getPaymentStatus.mockResolvedValue(credited);
    await payWithWidget();
    expect(widget.options.reference).toBe(REFERENCE);

    await act(async () => { widget.callback({ transaction: { id: 'tx-1' } }); });
    await flush();

    expect(payments.getPaymentStatus).toHaveBeenCalledWith(REFERENCE, 'tx-1');
    expect(screen.getByText('Pago aprobado')).toBeTruthy();
    expect(refreshUser).toHaveBeenCalled();
    expect(sessionStorage.getItem('eldorado.pendingRecharge')).toBeNull();
  });

  it('regresión 403: el Widget se abre SIN redirectUrl (con localhost, checkout.wompi.co responde 403)', async () => {
    await payWithWidget();
    expect(widget.options).not.toHaveProperty('redirectUrl');
    expect(Object.keys(widget.options).sort()).toEqual(['amountInCents', 'currency', 'publicKey', 'reference', 'signature']);
    expect(widget.options.signature).toEqual({ integrity: 'f'.repeat(64) });
  });

  it('callback sin id: una consulta por referencia y, si sigue PENDING, "Todavía no recibimos…" con "Verificar de nuevo"', async () => {
    payments.getPaymentStatus.mockResolvedValueOnce({ reference: REFERENCE, status: 'PENDING' });
    await payWithWidget();
    await act(async () => { widget.callback({}); });
    await flush();

    expect(payments.getPaymentStatus).toHaveBeenCalledTimes(1);
    expect(payments.getPaymentStatus).toHaveBeenCalledWith(REFERENCE, undefined);
    expect(screen.queryByText(/Procesando… estamos confirmando/)).toBeNull();
    expect(screen.getByText('Todavía no recibimos la confirmación de Wompi')).toBeTruthy();

    payments.getPaymentStatus.mockResolvedValue(credited);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar de nuevo' }));
    await flush();
    expect(payments.getPaymentStatus).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Pago aprobado')).toBeTruthy();
  });

  it('callback sin id que ya está aprobado en Wompi: "Pago aprobado" en la primera consulta', async () => {
    payments.getPaymentStatus.mockResolvedValue(credited);
    await payWithWidget();
    await act(async () => { widget.callback(undefined); });
    await flush();
    expect(payments.getPaymentStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Pago aprobado')).toBeTruthy();
  });

  it('camino a: al volver con ?id= de la redirect-url verifica esa transacción y limpia la URL', async () => {
    sessionStorage.setItem('eldorado.pendingRecharge', REFERENCE);
    payments.getPaymentStatus.mockResolvedValue({ reference: REFERENCE, status: 'DECLINED' });
    renderPanel('/wallet?id=tx-9&tab=deposit');
    await flush();

    expect(payments.getPaymentStatus).toHaveBeenCalledWith(REFERENCE, 'tx-9');
    // StrictMode ejecuta el efecto dos veces: igual se verifica una sola vez.
    expect(payments.getPaymentStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Pago rechazado')).toBeTruthy();
  });

  it('camino a sin recarga pendiente en la pestaña: verifica solo con el id', async () => {
    payments.verifyTransaction.mockResolvedValue(credited);
    renderPanel('/wallet?id=tx-10');
    await flush();
    expect(payments.verifyTransaction).toHaveBeenCalledWith('tx-10');
    expect(screen.getByText('Pago aprobado')).toBeTruthy();
  });

  it('sin confirmación después del tope: "Todavía no recibimos la confirmación" y "Verificar de nuevo"', async () => {
    payments.getPaymentStatus.mockResolvedValue({ reference: REFERENCE, status: 'PENDING' });
    await payWithWidget();
    await act(async () => { widget.callback({ transaction: { id: 'tx-2' } }); });
    await flush(3000 * 25);

    expect(payments.getPaymentStatus).toHaveBeenCalledTimes(20);
    expect(screen.queryByText(/Procesando… estamos confirmando/)).toBeNull();
    expect(screen.getByText('Todavía no recibimos la confirmación de Wompi')).toBeTruthy();

    payments.getPaymentStatus.mockResolvedValue(credited);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar de nuevo' }));
    await flush();
    expect(payments.getPaymentStatus).toHaveBeenLastCalledWith(REFERENCE, 'tx-2');
    expect(screen.getByText('Pago aprobado')).toBeTruthy();
  });

  it('errores de red o 5xx se reintentan y también terminan con el tope', async () => {
    payments.getPaymentStatus.mockRejectedValue(Object.assign(new Error('Wompi no responde'), { status: 503 }));
    await payWithWidget();
    await act(async () => { widget.callback({ transaction: { id: 'tx-3' } }); });
    await flush(3000 * 25);
    expect(payments.getPaymentStatus).toHaveBeenCalledTimes(20);
    expect(screen.getByText('Todavía no recibimos la confirmación de Wompi')).toBeTruthy();
  });

  it('un 4xx detiene la verificación y muestra el error', async () => {
    payments.getPaymentStatus.mockRejectedValue(Object.assign(new Error('La recarga no existe.'), { status: 404 }));
    await payWithWidget();
    await act(async () => { widget.callback({ transaction: { id: 'tx-4' } }); });
    await flush(3000 * 5);
    expect(payments.getPaymentStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByText('La recarga no existe.')).toBeTruthy();
    expect(screen.queryByText(/Procesando… estamos confirmando/)).toBeNull();
  });

  it('al volver a /wallet con una recarga pendiente en la pestaña, la verifica sola', async () => {
    sessionStorage.setItem('eldorado.pendingRecharge', REFERENCE);
    payments.getPaymentStatus.mockResolvedValue(credited);
    renderPanel();
    await flush();
    expect(payments.getPaymentStatus).toHaveBeenCalledWith(REFERENCE, undefined);
    expect(screen.getByText('Pago aprobado')).toBeTruthy();
  });
});
