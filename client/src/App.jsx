import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import HostDashboard from './pages/HostDashboard.jsx';
import QuizEditor from './pages/QuizEditor.jsx';
import HostGameRoom from './pages/HostGameRoom.jsx';
import PlayerJoin from './pages/PlayerJoin.jsx';
import PlayerGamePad from './pages/PlayerGamePad.jsx';
import SessionHistory from './pages/SessionHistory.jsx';
import SessionReport from './pages/SessionReport.jsx';

import ProjectorDisplay from './pages/ProjectorDisplay.jsx';
import RevisionReceipt from './pages/RevisionReceipt.jsx';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SocketProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/join" element={<PlayerJoin />} />
          <Route path="/play" element={<PlayerGamePad />} />
          <Route path="/display/:pin" element={<ProjectorDisplay />} />
          <Route path="/r/:token" element={<RevisionReceipt />} />

          {/* Protected Teacher Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/host" element={<HostDashboard />} />
            <Route path="/dashboard" element={<Navigate to="/host" replace />} />
            <Route path="/host/quiz/:id" element={<QuizEditor />} />
            <Route path="/host/room/:id" element={<HostGameRoom />} />
            <Route path="/host/:id" element={<HostGameRoom />} />
            <Route path="/host/sessions" element={<SessionHistory />} />
            <Route path="/history" element={<Navigate to="/host/sessions" replace />} />
            <Route path="/host/sessions/:id" element={<SessionReport />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SocketProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
