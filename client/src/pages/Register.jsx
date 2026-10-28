import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext.jsx';
import { errorMessage } from '../api.js';
import AuthShell from '../components/AuthShell.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ studentId: '', name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await register({
        studentId: form.studentId.trim(),
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
      });
      navigate('/');
    } catch (err) {
      const detail = err?.response?.data?.details?.[0];
      setError(detail ? detail.message : errorMessage(err));
      setBusy(false);
    }
  };

  const fade = (delay) => ({
    initial: { opacity: 0, x: -14 },
    animate: { opacity: 1, x: 0 },
    transition: { delay },
  });

  return (
    <AuthShell
      title="Join the electorate"
      subtitle="Register as a student voter to participate in academic elections."
      footnote={
        <>
          Already registered? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {error && (
        <motion.div className="form-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          {error}
        </motion.div>
      )}
      <form onSubmit={onSubmit} noValidate>
        <motion.div className="field" {...fade(0.22)}>
          <label htmlFor="studentId">Student ID</label>
          <input id="studentId" className="input" value={form.studentId} onChange={set('studentId')} autoComplete="username" required />
        </motion.div>
        <motion.div className="field" {...fade(0.28)}>
          <label htmlFor="name">Full name</label>
          <input id="name" className="input" value={form.name} onChange={set('name')} autoComplete="name" required />
        </motion.div>
        <motion.div className="field" {...fade(0.34)}>
          <label htmlFor="email">Email (optional)</label>
          <input id="email" className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
        </motion.div>
        <motion.div className="field" {...fade(0.4)}>
          <label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required />
          <div className="hint">At least 8 characters, with a letter and a number.</div>
        </motion.div>
        <motion.div className="field" {...fade(0.46)}>
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" className="input" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required />
        </motion.div>
        <motion.button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={busy}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.52 }}
        >
          {busy ? 'Creating account…' : 'Create my account'}
        </motion.button>
      </form>
    </AuthShell>
  );
}
