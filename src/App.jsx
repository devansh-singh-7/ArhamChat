import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ChatListPage } from './pages/ChatListPage'
import './App.css'

function LegacyChatRedirect() {
  const { conversationId } = useParams()
  return <Navigate to={`/chats/${conversationId}`} replace />
}

function AppShell() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <main className="app-loading-screen">
        <p className="app-loading-copy">Checking session...</p>
      </main>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/chats" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/chats"
          element={(
            <ProtectedRoute>
              <ChatListPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/chats/:conversationId"
          element={(
            <ProtectedRoute>
              <ChatListPage />
            </ProtectedRoute>
          )}
        />
        <Route path="/chat/:conversationId" element={<LegacyChatRedirect />} />
        <Route path="*" element={<Navigate to="/chats" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
