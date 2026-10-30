import apiClient from './apiClient';

export const catalogNames = [
  'user_status',
  'account_status',
  'match_status',
  'bet_status',
  'player_position',
  'odds_market',
  'odds_outcome',
  'movement_type',
];

export async function getCatalogs() {
  return apiClient.get('/api/catalogs');
}

export async function getTableRecords(table) {
  return apiClient.get(`/api/${table}`);
}

export async function createTableRecord(table, payload) {
  return apiClient.post(`/api/${table}`, payload);
}
