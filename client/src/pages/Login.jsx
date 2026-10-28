import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext.jsx';
import { errorMessage } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(studentId.trim(), password);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your student ID to access the voting floor."
      footnote={
        <>
          No account yet? <Link to="/register">Create one</Link> · Demo: <span className="mono">student001 / Student@2026</span>
        </>
      }
    >
      {error && (
        <motion.div className="form-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          {error}
        </motion.div>
      )}
      <form onSubmit={onSubmit} noValidate>
        <motion.div className="field" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
          <label htmlFor="studentId">Student ID</label>
          <input
            id="studentId"
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </motion.div>
        <motion.div className="field" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.33 }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </motion.div>
        <motion.button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={busy}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
        >
          {busy ? 'Signing in…' : 'Enter the voting floor →'}
        </motion.button>
      </form>
    </AuthShell>
  );
}
