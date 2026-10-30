import apiClient from './apiClient';

export async function loginUser(email, password) {
  const data = await apiClient.post('/api/auth/login', { username: email, password });
  return data.user;
}

export async function registerUser(data) {
  const responseData = await apiClient.post('/api/auth/register', data);
  return responseData.user;
}

export async function getCurrentUser() {
  const responseData = await apiClient.get('/api/auth/me');
  return responseData.user;
}

export async function logoutUser() {
  await apiClient.post('/api/auth/logout', {});
}

export async function createBalanceMovement(type, amount) {
  const response = await apiClient.post(`/api/auth/balance/${type}`, { amount });
  return response.balance;
}
