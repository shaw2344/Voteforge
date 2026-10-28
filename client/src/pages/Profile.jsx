import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, errorMessage } from '../api.js';
import { staggerContainer, fadeUp } from '../motion.js';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState({ name: user.name, email: user.email || '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyPw, setBusyPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    setBusyProfile(true);
    try {
      const res = await api.patch('/auth/profile', {
        name: profile.name.trim(),
        email: profile.email.trim() || '',
      });
      setUser(res.data.user);
      setProfileMsg('Profile updated.');
    } catch (err) {
      setProfileErr(errorMessage(err));
    } finally {
      setBusyProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg('');
    setPwErr('');
    if (pw.next !== pw.confirm) {
      setPwErr('New passwords do not match.');
      return;
    }
    setBusyPw(true);
    try {
      await api.post('/auth/password', {
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg('Password updated. Your other sessions were signed out.');
    } catch (err) {
      setPwErr(errorMessage(err));
    } finally {
      setBusyPw(false);
    }
  };

  return (
    <div className="container">
      <motion.div variants={staggerContainer(0.1)} initial="hidden" animate="show">
        <motion.div className="page-header" variants={fadeUp}>
          <div>
            <h1 className="page-title">Profile</h1>
            <p className="page-sub">Manage your voter account and security.</p>
          </div>
        </motion.div>

        <div className="grid grid-2">
          <motion.div className="card card-pad" variants={fadeUp}>
            <h2 className="card-title">Account details</h2>
            <p className="card-sub">Your identity as shown to election administrators.</p>
            {profileMsg && <div className="form-success">{profileMsg}</div>}
            {profileErr && <div className="form-error">{profileErr}</div>}
            <form onSubmit={saveProfile}>
              <div className="field">
                <label>Student ID</label>
                <input className="input" value={user.studentId} disabled />
                <div className="hint">Student IDs cannot be changed.</div>
              </div>
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  className="input"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busyProfile}>
                {busyProfile ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </motion.div>

          <motion.div className="card card-pad" variants={fadeUp}>
            <h2 className="card-title">Change password</h2>
            <p className="card-sub">Rotating your password signs out all other sessions.</p>
            {pwMsg && <div className="form-success">{pwMsg}</div>}
            {pwErr && <div className="form-error">{pwErr}</div>}
            <form onSubmit={changePassword}>
              <div className="field">
                <label htmlFor="current">Current password</label>
                <input
                  id="current"
                  className="input"
                  type="password"
                  value={pw.current}
                  onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="next">New password</label>
                <input
                  id="next"
                  className="input"
                  type="password"
                  value={pw.next}
                  onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
                <div className="hint">At least 8 characters, with a letter and a number.</div>
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm new password</label>
                <input
                  id="confirm"
                  className="input"
                  type="password"
                  value={pw.confirm}
                  onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </div>
              <button className="btn" type="submit" disabled={busyPw}>
                {busyPw ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
