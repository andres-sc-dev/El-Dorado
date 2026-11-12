import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../services/authService';

const AuthContext = createContext(null);

// El saldo y el rol siempre vienen de la API (PostgreSQL y SQL Server). La interfaz
// nunca suma ni resta saldo por su cuenta: después de apostar se vuelve a leer.
function normalizeUser(user) {
  if (!user) return user;
  return {
    ...user,
    balance: user.balance === null || user.balance === undefined ? null : Number(user.balance),
    claimedBonuses: user.claimedBonuses ?? [],
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((currentUser) => { if (mounted) setUser(normalizeUser(currentUser)); })
      .catch(() => { if (mounted) setUser(null); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (identifier, password) => {
    const loggedUser = normalizeUser(await loginUser(identifier, password));
    setUser(loggedUser);
    return loggedUser;
  }, []);

  // Registrar una cuenta no inicia sesión: la persona vuelve al login.
  const register = useCallback(async (data) => normalizeUser(await registerUser(data)), []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  // Vuelve a leer el usuario y su saldo desde la API.
  const refreshUser = useCallback(async () => {
    try {
      setUser(normalizeUser(await getCurrentUser()));
    } catch {
      // Si falla, se conserva lo que había.
    }
  }, []);

  const setBalance = useCallback((balance) => {
    setUser((current) => (current ? { ...current, balance: Number(balance) } : current));
  }, []);

  // Las promociones son solo visuales (no hay tabla de bonos): no tocan el saldo.
  const claimBonus = useCallback((bonusId) => {
    setUser((current) => {
      if (!current || current.claimedBonuses.includes(bonusId)) return current;
      return { ...current, claimedBonuses: [...current.claimedBonuses, bonusId] };
    });
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAdmin: user?.role === 'ADM',
    login,
    logout,
    register,
    refreshUser,
    setBalance,
    claimBonus,
  }), [user, isLoading, login, logout, register, refreshUser, setBalance, claimBonus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
