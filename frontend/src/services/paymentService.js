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

// Al volver de la redirect-url de Wompi solo se tiene el ?id= de la transacción.
export async function verifyTransaction(transactionId) {
  return apiClient.get(`/api/payments/transactions/${encodeURIComponent(transactionId)}`);
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
      // Si el script no responde en 15 s se rechaza: el botón no se queda en "Preparando…".
      const timer = setTimeout(() => {
        widgetPromise = undefined;
        reject(new Error('El Widget de Wompi tardó demasiado en cargar. Intenta de nuevo.'));
      }, 15000);
      script.onload = () => {
        clearTimeout(timer);
        if (window.WidgetCheckout) resolve(window.WidgetCheckout);
        else reject(new Error('El Widget de Wompi no cargó.'));
      };
      script.onerror = () => {
        clearTimeout(timer);
        widgetPromise = undefined;
        reject(new Error('No se pudo cargar el Widget de Wompi. Revisa tu conexión.'));
      };
      document.head.appendChild(script);
    });
  }
  return widgetPromise;
}
