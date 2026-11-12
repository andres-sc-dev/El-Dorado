import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BetSlipProvider } from './context/BetSlipContext';
import AppRouter from './router/AppRouter';
import MobileBetSlipBar from './components/betting/MobileBetSlipBar';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BetSlipProvider>
          <AppRouter />
          <MobileBetSlipBar />
        </BetSlipProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
