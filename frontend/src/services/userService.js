import apiClient from './apiClient';

export async function getUserById(userId) {
  return apiClient.get(`/api/users/${userId}`);
}

export async function getUserBalance(userId) {
  const result = await apiClient.get(`/api/users/${userId}/balance`);
  return result.balance;
}
