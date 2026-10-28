import { Routes, Route, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import NavBar from './components/NavBar.jsx';
import { RequireAuth } from './auth/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ElectionDetail from './pages/ElectionDetail.jsx';
import Results from './pages/Results.jsx';
import LiveResults from './pages/LiveResults.jsx';
import MyVotes from './pages/MyVotes.jsx';
import Profile from './pages/Profile.jsx';
import Admin from './pages/Admin.jsx';
import SecurityCopilot from './pages/SecurityCopilot.jsx';

export default function App() {
  const location = useLocation();

  return (
    <>
      <NavBar />
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <Routes location={location}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/results"
            element={
              <RequireAuth>
                <LiveResults />
              </RequireAuth>
            }
          />
          <Route
            path="/my-votes"
            element={
              <RequireAuth>
                <MyVotes />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/elections/:id"
            element={
              <RequireAuth>
                <ElectionDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/elections/:id/results"
            element={
              <RequireAuth>
                <Results />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth adminOnly>
                <Admin />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/security"
            element={
              <RequireAuth adminOnly>
                <SecurityCopilot />
              </RequireAuth>
            }
          />
        </Routes>
      </motion.div>
    </>
  );
}
