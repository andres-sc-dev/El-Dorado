import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BetSlipProvider } from './context/BetSlipContext';
import AppRouter from './router/AppRouter';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BetSlipProvider>
          <AppRouter />
        </BetSlipProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
