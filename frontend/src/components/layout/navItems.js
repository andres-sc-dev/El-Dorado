// Menú por rol: el ADM no ve apuestas ni billetera; el USR no ve la administración.
const NAV_ITEMS = [
  { label: 'Inicio', to: '/' },
  { label: 'Partidos', to: '/matches' },
  { label: 'Mis apuestas', to: '/my-bets', roles: ['USR'] },
  { label: 'Billetera', to: '/wallet', roles: ['USR'] },
  { label: 'Perfil', to: '/profile', roles: ['USR', 'ADM'] },
  { label: 'Administración', to: '/admin', roles: ['ADM'] },
];

export function visibleNavItems(user) {
  return NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
}
