import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Layout } from './Layout'
import { ToastProvider, PeriodProvider } from '../lib/context'
import { AuthProvider, useAuth } from '../lib/AuthContext'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { DashboardPage } from '../pages/DashboardPage'
import { ProductsPage } from '../pages/ProductsPage'
import { FinancePage } from '../pages/FinancePage'
import { UploadPage } from '../pages/UploadPage'
import { SettingsPage } from '../pages/SettingsPage'
import { LoginPage } from '../pages/LoginPage'

const GOOGLE_CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <PeriodProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<AuthGuard><Layout /></AuthGuard>}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/finance" element={<FinancePage />} />
                  <Route path="/upload" element={<UploadPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </PeriodProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
