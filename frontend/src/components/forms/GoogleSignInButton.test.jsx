import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GoogleSignInButton from './GoogleSignInButton';
import * as google from '../../services/googleAuthService';

vi.mock('../../services/googleAuthService', async (importOriginal) => {
  const real = await importOriginal();
  return {
    googleErrorMessage: real.googleErrorMessage,
    signInWithGooglePopup: vi.fn(),
    loginWithGoogleToken: vi.fn(),
    signOutGoogle: vi.fn(async () => {}),
  };
});
vi.mock('../../config/firebase', () => ({ isFirebaseConfigured: true, getFirebaseAuth: () => null, createGoogleProvider: () => null }));

const setSessionUser = vi.fn();
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ setSessionUser }) }));

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}|{location.state?.email ?? ''}</p>;
}

function renderButton() {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<GoogleSignInButton />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
}

const click = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Continuar con Google/ })); }); };

beforeEach(() => { google.signInWithGooglePopup.mockResolvedValue('id-token-de-prueba'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('GoogleSignInButton', () => {
  it('202 PROFILE_INCOMPLETE: va a /complete-profile con el correo', async () => {
    google.loginWithGoogleToken.mockResolvedValue({ status: 'PROFILE_INCOMPLETE', email: 'ana@gmail.com', name: 'Ana' });
    renderButton();
    await click();
    expect(google.loginWithGoogleToken).toHaveBeenCalledWith('id-token-de-prueba');
    expect(screen.getByTestId('where').textContent).toBe('/complete-profile|ana@gmail.com');
    expect(setSessionUser).not.toHaveBeenCalled();
  });

  it('200 LOGGED_IN: deja la sesión en AuthContext y va al inicio', async () => {
    const user = { username: 'ana', role: 'USR', balance: 0 };
    google.loginWithGoogleToken.mockResolvedValue({ status: 'LOGGED_IN', user });
    renderButton();
    await click();
    expect(setSessionUser).toHaveBeenCalledWith(user);
    expect(screen.getByTestId('where').textContent).toBe('/|');
  });

  it('popup cerrado o bloqueado: mensaje amable', async () => {
    google.signInWithGooglePopup.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' }));
    renderButton();
    await click();
    expect(screen.getByRole('alert').textContent).toMatch(/Cerraste la ventana de Google/);

    google.signInWithGooglePopup.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/popup-blocked' }));
    await click();
    expect(screen.getByRole('alert').textContent).toMatch(/bloqueó la ventana de Google/);
  });

  it('409 de una cuenta LOCAL: muestra el mensaje del backend y cierra la sesión de Google', async () => {
    google.loginWithGoogleToken.mockRejectedValue(Object.assign(new Error('Ya existe una cuenta con ese correo; entra con tu contraseña.'), { status: 409 }));
    renderButton();
    await click();
    expect(screen.getByRole('alert').textContent).toMatch(/entra con tu contraseña/);
    expect(google.signOutGoogle).toHaveBeenCalled();
  });
});
