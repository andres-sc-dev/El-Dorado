import { Route, Routes } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import MatchesPage from '../pages/MatchesPage';
import MyBetsPage from '../pages/MyBetsPage';
import PromotionsPage from '../pages/PromotionsPage';
import ProfilePage from '../pages/ProfilePage';
import WalletPage from '../pages/WalletPage';
import ProtectedRoute from './ProtectedRoute';
import AdminDataPage from '../pages/AdminDataPage';

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/matches" element={<MatchesPage />} />
      <Route path="/promotions" element={<PromotionsPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/my-bets" element={<MyBetsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/admin/data-entry" element={<AdminDataPage />} />
      </Route>
    </Routes>
  );
}

export default AppRouter;
