import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, errorMessage } from '../api.js';
import { formatDate } from '../utils.js';
import StatusBadge from '../components/StatusBadge.jsx';
import AnimatedBarList from '../components/AnimatedBarList.jsx';
import { fadeUp, staggerContainer, scaleIn } from '../motion.js';

const emptyPosition = () => ({ title: '', candidates: [{ name: '', bio: '' }, { name: '', bio: '' }] });
const emptyElection = {
  title: '',
  description: '',
  type: 'candidate',
  startsAt: '',
  endsAt: '',
  status: 'active',
  positions: [emptyPosition()],
  options: ['', ''],
};

function toIsoInput(local) {
  if (!local) return '';
  return new Date(local).toISOString();
}

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [elections, setElections] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const AUDIT_PAGE = 50;

  const notify = (msg) => {
    setMessage(msg);
    setError('');
    window.setTimeout(() => setMessage(''), 4000);
  };
  const notifyError = (msg) => {
    setError(msg);
    setMessage('');
  };

  const loadStats = useCallback(async () => {
    const res = await api.get('/admin/stats');
    setStats(res.data.stats);
  }, []);

  const loadElections = useCallback(async () => {
    const res = await api.get('/admin/elections');
    setElections(res.data.elections);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await api.get('/admin/users');
    setUsers(res.data.users);
  }, []);

  const loadAudit = useCallback(
    async (offset = 0) => {
      const res = await api.get(`/admin/audit?limit=${AUDIT_PAGE}&offset=${offset}`);
      setAudit(res.data.entries);
      setAuditTotal(res.data.total);
      setAuditOffset(offset);
    },
    [AUDIT_PAGE]
  );

  useEffect(() => {
    Promise.all([loadStats(), loadElections()]).catch((err) => notifyError(errorMessage(err)));
  }, [loadStats, loadElections]);

  useEffect(() => {
    if (tab === 'audit') loadAudit().catch((err) => notifyError(errorMessage(err)));
  }, [tab, loadAudit]);

  const refreshAll = async () => {
    await Promise.all([loadStats(), loadElections()]);
  };

  const onSetStatus = async (id, status) => {
    try {
      await api.post(`/admin/elections/${id}/status`, { status });
      await refreshAll();
      notify('Election status updated.');
    } catch (err) {
      notifyError(errorMessage(err));
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this election and all its votes? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/elections/${id}`);
      await refreshAll();
      notify('Election deleted.');
    } catch (err) {
      notifyError(errorMessage(err));
    }
  };

  const onSimulate = async (id) => {
    const input = window.prompt('How many simulated voters to generate?', '200');
    const count = Number(input);
    if (!Number.isInteger(count) || count < 1) return;
    try {
      const res = await api.post(`/admin/elections/${id}/simulate`, { voterCount: count });
      notify(`Simulation complete: ${res.data.createdUsers} voters, ${res.data.createdVotes} votes.`);
      await refreshAll();
    } catch (err) {
      notifyError(errorMessage(err));
    }
  };

  return (
    <div className="container">
      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show">
        <motion.div className="page-header" variants={fadeUp}>
          <div>
            <h1 className="page-title">Administration</h1>
            <p className="page-sub">Manage elections, users, and run simulations.</p>
          </div>
        </motion.div>

        {message && <div className="form-success">{message}</div>}
        {error && <div className="form-error">{error}</div>}

        {stats && (
          <motion.div className="stats-row" variants={fadeUp}>
            {[
              ['Users', stats.users],
              ['Simulated', stats.simulated],
              ['Elections', stats.elections],
              ['Votes', stats.votes],
            ].map(([label, value], i) => (
              <motion.div className="card stat-card" key={label} variants={scaleIn}>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.div className="row mb-16" variants={fadeUp} style={{ gap: 8, flexWrap: 'wrap' }}>
          {[
            ['overview', 'Overview'],
            ['elections', 'Elections'],
            ['create', 'Create election'],
            ['users', 'Voters'],
            ['audit', 'Audit log'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`btn btn-sm ${tab === key ? 'btn-primary' : ''}`}
              onClick={async () => {
                setTab(key);
                try {
                  if (key === 'users') await loadUsers();
                  if (key === 'audit') await loadAudit();
                } catch (err) {
                  notifyError(errorMessage(err));
                }
              }}
            >
              {label}
            </button>
          ))}
        </motion.div>

        {tab === 'overview' && (
          <motion.div className="grid grid-2" variants={fadeUp}>
            <div className="card chart-card">
              <h2 className="chart-title">Ballots per election</h2>
              <AnimatedBarList
                items={elections.map((e) => ({ id: e.id, name: e.title, votes: e.voterCount }))}
                total={Math.max(...elections.map((e) => e.voterCount), 1)}
                colors={['bar-fill violet', 'bar-fill cyan', 'bar-fill green', 'bar-fill amber']}
              />
              {elections.length === 0 && <div className="empty">No elections yet.</div>}
            </div>
            <div className="card chart-card">
              <div className="row-between">
                <h2 className="chart-title">Recent activity</h2>
                <button className="btn btn-sm btn-ghost" onClick={() => setTab('audit')}>
                  Full log →
                </button>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {audit.slice(0, 8).map((a) => (
                  <div key={a.id} className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
                    <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {a.action}
                    </span>
                    <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                ))}
                {audit.length === 0 && <div className="empty">No activity yet.</div>}
              </div>
            </div>
          </motion.div>
        )}

        {tab === 'elections' && (
          <motion.div className="table-wrap" variants={fadeUp}>
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Votes</th>
                  <th>Window</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {elections.map((e) => (
                  <tr key={e.id}>
                    <td className="mono">#{e.id}</td>
                    <td>{e.title}</td>
                    <td>{e.type === 'candidate' ? 'Candidate' : 'Proposal'}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>{e.voterCount}</td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      {formatDate(e.startsAt)} → {formatDate(e.endsAt)}
                    </td>
                    <td>
                      <div className="row flex-wrap" style={{ gap: 6 }}>
                        {e.storedStatus === 'draft' && (
                          <button className="btn btn-sm btn-primary" onClick={() => onSetStatus(e.id, 'active')}>
                            Activate
                          </button>
                        )}
                        {e.status !== 'closed' && (
                          <button className="btn btn-sm" onClick={() => onSetStatus(e.id, 'closed')}>
                            Close
                          </button>
                        )}
                        <button className="btn btn-sm" onClick={() => onSimulate(e.id)}>
                          Simulate
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => onDelete(e.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {elections.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center' }}>
                      No elections.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </motion.div>
        )}

        {tab === 'create' && (
          <CreateElectionForm
            onDone={async () => {
              await refreshAll();
              setTab('elections');
            }}
          />
        )}

        {tab === 'users' && (
          <motion.div className="table-wrap" variants={fadeUp}>
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Source</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="mono">#{u.id}</td>
                    <td className="mono">{u.studentId}</td>
                    <td>{u.name}</td>
                    <td className="muted">{u.email || '—'}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-admin' : 'badge-student'}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`badge ${u.isSimulated ? 'badge-upcoming' : 'badge-draft'}`}>
                        {u.isSimulated ? 'Simulated' : 'Manual'}
                      </span>
                    </td>
                    <td className="muted">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center' }}>
                      No users.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </motion.div>
        )}

        {tab === 'audit' && (
          <motion.div variants={fadeUp}>
            <div className="row-between mb-16">
              <span className="muted" style={{ fontSize: 13 }}>
                {auditTotal} events recorded
              </span>
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="btn btn-sm"
                  disabled={auditOffset === 0}
                  onClick={() => loadAudit(Math.max(auditOffset - AUDIT_PAGE, 0))}
                >
                  ← Newer
                </button>
                <button
                  className="btn btn-sm"
                  disabled={auditOffset + AUDIT_PAGE >= auditTotal}
                  onClick={() => loadAudit(auditOffset + AUDIT_PAGE)}
                >
                  Older →
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Detail</th>
                    <th>IP</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">#{a.id}</td>
                      <td>
                        {a.user ? (
                          <span>
                            {a.user.name} <span className="mono muted">({a.user.studentId})</span>
                          </span>
                        ) : (
                          <span className="muted">system</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${a.action.startsWith('vote') ? 'badge-active' : a.action.startsWith('auth') ? 'badge-student' : 'badge-upcoming'}`}>
                          {a.action}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 13 }}>{a.detail || '—'}</td>
                      <td className="mono muted">{a.ip || '—'}</td>
                      <td className="muted" style={{ fontSize: 13 }}>{formatDate(a.createdAt)}</td>
                    </tr>
                  ))}
                  {audit.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted" style={{ textAlign: 'center' }}>
                        No events recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function CreateElectionForm({ onDone }) {
  const [form, setForm] = useState(emptyElection);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const setPosition = (i, key, value) =>
    setForm((f) => {
      const positions = f.positions.map((p, pi) => (pi === i ? { ...p, [key]: value } : p));
      return { ...f, positions };
    });

  const setCandidate = (pi, ci, key, value) =>
    setForm((f) => {
      const positions = f.positions.map((p, idx) => {
        if (idx !== pi) return p;
        const candidates = p.candidates.map((c, cidx) => (cidx === ci ? { ...c, [key]: value } : c));
        return { ...p, candidates };
      });
      return { ...f, positions };
    });

  const setOption = (i, value) =>
    setForm((f) => {
      const options = f.options.map((o, oi) => (oi === i ? value : o));
      return { ...f, options };
    });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        startsAt: toIsoInput(form.startsAt),
        endsAt: toIsoInput(form.endsAt),
        status: form.status,
      };
      if (form.type === 'candidate') {
        payload.positions = form.positions
          .filter((p) => p.title.trim())
          .map((p) => ({
            title: p.title.trim(),
            candidates: p.candidates
              .filter((c) => c.name.trim())
              .map((c) => ({ name: c.name.trim(), bio: c.bio.trim() })),
          }));
      } else {
        payload.options = form.options.filter((o) => o.trim());
      }
      await api.post('/admin/elections', payload);
      onDone();
    } catch (err) {
      const detail = err?.response?.data?.details?.[0];
      setError(detail ? detail.message : errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <motion.div className="card card-pad" variants={fadeUp}>
      <h2 className="card-title">Create election</h2>
      <p className="card-sub">Set up a new ballot for voters.</p>
      {error && <div className="form-error">{error}</div>}
      <form onSubmit={onSubmit}>
        <div className="grid grid-2">
          <div className="field">
            <label>Election type</label>
            <select className="input" value={form.type} onChange={set('type')}>
              <option value="candidate">Candidate ballot (positions & candidates)</option>
              <option value="proposal">Proposal ballot (yes/no options)</option>
            </select>
          </div>
          <div className="field">
            <label>Initial status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="active">Active (open for voting)</option>
              <option value="draft">Draft (activate later)</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Title</label>
          <input className="input" value={form.title} onChange={set('title')} required minLength={3} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea className="input" value={form.description} onChange={set('description')} />
        </div>

        <div className="grid grid-2">
          <div className="field">
            <label>Starts at</label>
            <input className="input" type="datetime-local" value={form.startsAt} onChange={set('startsAt')} required />
          </div>
          <div className="field">
            <label>Ends at</label>
            <input className="input" type="datetime-local" value={form.endsAt} onChange={set('endsAt')} required />
          </div>
        </div>

        {form.type === 'candidate' ? (
          <>
            <hr className="divider" />
            <h3 style={{ margin: '0 0 16px' }}>Positions & candidates</h3>
            {form.positions.map((p, pi) => (
              <div key={pi} className="card card-pad mb-16" style={{ background: 'var(--surface-2)' }}>
                <div className="row-between mb-16">
                  <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Position title</label>
                    <input className="input" placeholder="e.g. President" value={p.title} onChange={(e) => setPosition(pi, 'title', e.target.value)} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={form.positions.length === 1}
                    onClick={() => setForm((f) => ({ ...f, positions: f.positions.filter((_, i) => i !== pi) }))}
                  >
                    Remove
                  </button>
                </div>
                {p.candidates.map((c, ci) => (
                  <div key={ci} className="row mb-16" style={{ alignItems: 'flex-start' }}>
                    <input className="input" placeholder={`Candidate ${ci + 1} name`} value={c.name} onChange={(e) => setCandidate(pi, ci, 'name', e.target.value)} />
                    <input className="input" placeholder="Short bio (optional)" value={c.bio} onChange={(e) => setCandidate(pi, ci, 'bio', e.target.value)} />
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={p.candidates.length === 2}
                      onClick={() =>
                        setForm((f) => {
                          const positions = f.positions.map((pp, idx) =>
                            idx === pi ? { ...pp, candidates: pp.candidates.filter((_, i) => i !== ci) } : pp
                          );
                          return { ...f, positions };
                        })
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    setForm((f) => {
                      const positions = f.positions.map((pp, idx) =>
                        idx === pi ? { ...pp, candidates: [...pp.candidates, { name: '', bio: '' }] } : pp
                      );
                      return { ...f, positions };
                    })
                  }
                >
                  + Add candidate
                </button>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setForm((f) => ({ ...f, positions: [...f.positions, emptyPosition()] }))}>
              + Add position
            </button>
          </>
        ) : (
          <>
            <hr className="divider" />
            <h3 style={{ margin: '0 0 16px' }}>Options</h3>
            {form.options.map((o, i) => (
              <div key={i} className="row mb-16">
                <input className="input" placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOption(i, e.target.value)} />
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={form.options.length === 2}
                  onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, oi) => oi !== i) }))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn" onClick={() => setForm((f) => ({ ...f, options: [...f.options, ''] }))}>
              + Add option
            </button>
          </>
        )}

        <hr className="divider" />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create election'}
        </button>
      </form>
    </motion.div>
  );
}
