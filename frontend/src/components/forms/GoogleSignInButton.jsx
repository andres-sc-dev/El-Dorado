import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  googleErrorMessage, loginWithGoogleToken, signInWithGooglePopup, signOutGoogle,
} from '../../services/googleAuthService';

// "Continuar con Google": popup de Firebase -> idToken -> POST /api/auth/google.
// 200: sesión iniciada. 202: cuenta nueva, se completa el perfil en /complete-profile.
function GoogleSignInButton() {
  const navigate = useNavigate();
  const { setSessionUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setError('');
    setIsLoading(true);
    try {
      const idToken = await signInWithGooglePopup();
      const result = await loginWithGoogleToken(idToken);
      if (result.status === 'PROFILE_INCOMPLETE') {
        // La sesión de Google sigue abierta: /complete-profile pide un idToken fresco.
        navigate('/complete-profile', { state: { email: result.email, name: result.name } });
        return;
      }
      await signOutGoogle();
      setSessionUser(result.user);
      navigate(result.user?.role === 'ADM' ? '/admin' : '/');
    } catch (requestError) {
      await signOutGoogle();
      setError(requestError.status ? requestError.message : googleErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-3 rounded-md border border-white/20 bg-white px-4 py-2 font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
        </svg>
        {isLoading ? 'Conectando con Google…' : 'Continuar con Google'}
      </button>
      {error ? <p role="alert" className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

export default GoogleSignInButton;
