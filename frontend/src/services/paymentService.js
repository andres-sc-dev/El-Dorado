import apiClient from './apiClient';

export async function getPaymentConfig() {
  return apiClient.get('/api/payments/config');
}

export async function preparePayment(amountCop) {
  return apiClient.post('/api/payments/prepare', { amountCop });
}

export async function getPaymentStatus(reference, transactionId) {
  const query = transactionId ? `?transaction_id=${encodeURIComponent(transactionId)}` : '';
  return apiClient.get(`/api/payments/${encodeURIComponent(reference)}${query}`);
}

// Carga una sola vez el Widget oficial (docs.wompi.co: "Widget & Checkout Web").
let widgetPromise;
export function loadWompiWidget() {
  if (window.WidgetCheckout) return Promise.resolve(window.WidgetCheckout);
  if (!widgetPromise) {
    widgetPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.wompi.co/widget.js';
      script.async = true;
      script.onload = () => (window.WidgetCheckout ? resolve(window.WidgetCheckout) : reject(new Error('El Widget de Wompi no cargó.')));
      script.onerror = () => {
        widgetPromise = undefined;
        reject(new Error('No se pudo cargar el Widget de Wompi. Revisa tu conexión.'));
      };
      document.head.appendChild(script);
    });
  }
  return widgetPromise;
}
