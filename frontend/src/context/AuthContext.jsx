import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../services/authService';

const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) {
    return user;
  }

  return {
    ...user,
    balance: Number(user.balance ?? 0),
    bonusBalance: Number(user.bonusBalance ?? 0),
    claimedBonuses: user.claimedBonuses ?? [],
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((currentUser) => {
        if (mounted) setUser(normalizeUser(currentUser));
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const login = async (email, password) => {
    const loggedUser = normalizeUser(await loginUser(email, password));
    setUser(loggedUser);
    return loggedUser;
  };

  const register = async (data) => {
    // Registrar una cuenta no inicia sesión automáticamente. El usuario debe
    // volver al formulario de login e introducir sus credenciales.
    return normalizeUser(await registerUser(data));
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  const updateUser = (updates) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      return normalizeUser({ ...currentUser, ...updates });
    });
  };

  const claimBonus = (bonusId, value = 200000) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const alreadyClaimed = (currentUser.claimedBonuses ?? []).includes(bonusId);
      if (alreadyClaimed) {
        return currentUser;
      }

      const nextBonusBalance = Number(currentUser.bonusBalance ?? 0) + Number(value);

      return normalizeUser({
        ...currentUser,
        bonusBalance: nextBonusBalance,
        claimedBonuses: [...(currentUser.claimedBonuses ?? []), bonusId],
      });
    });
  };

  const addBalance = (amount) => {
    updateUser({ balance: Number((user?.balance ?? 0)) + Number(amount) });
  };

  const spendBalance = (amount) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const totalAvailable = Number(currentUser.balance ?? 0) + Number(currentUser.bonusBalance ?? 0);
      const safeAmount = Number(amount || 0);

      if (safeAmount <= 0 || safeAmount > totalAvailable) {
        return currentUser;
      }

      let remaining = safeAmount;
      let nextBalance = Number(currentUser.balance ?? 0);
      let nextBonusBalance = Number(currentUser.bonusBalance ?? 0);

      if (nextBalance >= remaining) {
        nextBalance -= remaining;
        remaining = 0;
      } else {
        remaining -= nextBalance;
        nextBalance = 0;

        if (nextBonusBalance >= remaining) {
          nextBonusBalance -= remaining;
          remaining = 0;
        } else {
          remaining -= nextBonusBalance;
          nextBonusBalance = 0;
        }
      }

      return normalizeUser({
        ...currentUser,
        balance: nextBalance,
        bonusBalance: nextBonusBalance,
      });
    });
  };

  // Only the balance returned by SQL Server can be used for a bet. Promotion
  // state is intentionally UI-only because there is no bonus table in the
  // current schema.
  const getAvailableBalance = () => Number(user?.balance ?? 0);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      logout,
      register,
      updateUser,
      claimBonus,
      addBalance,
      spendBalance,
      getAvailableBalance,
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}
