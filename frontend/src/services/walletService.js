import apiClient from './apiClient';

// Saldo y movimientos del dueño de la sesión.
export async function getWallet() {
  return apiClient.get('/api/wallet/me');
}

// Datos personales del cliente (SQL Server).
export async function getCustomer() {
  return apiClient.get('/api/customer');
}
