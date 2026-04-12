import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginForm } from './components/LoginForm'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { DashboardPage } from './pages/DashboardPage'
import { InternDetailsPage } from './pages/InternDetailsPage'
import { MonthlyReportPage } from './pages/MonthlyReportPage'

function AuthenticatedApp() {
  const { session, loading } = useAuth()

  if (loading) {
    return <main className="p-4 text-sm text-slate-600">Carregando...</main>
  }

  if (!session) {
    return <LoginForm />
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/estagiaria/:id" element={<InternDetailsPage />} />
      <Route path="/relatorio" element={<MonthlyReportPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
