import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { api, errorMessage } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import { staggerContainer, fadeUp } from '../motion.js';

const TYPE_ICON = { candidate: '👥', proposal: '📋' };

export default function LiveResults() {
  const [overview, setOverview] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef(null);

  const load = useCallback(() => {
    return api
      .get('/elections/overview')
      .then((res) => setOverview(res.data.overview))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
    const socket = io({ withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('overview:update', load);
    const timer = window.setInterval(load, 10000);
    return () => {
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, [load]);

  if (error) {
    return (
      <div className="container">
        <div className="form-error">{error}</div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="container">
        <div className="page-center">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const liveCount = overview.filter((e) => e.status === 'active').length;

  return (
    <div className="container">
      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show">
        <motion.div className="page-header" variants={fadeUp}>
          <div>
            <h1 className="page-title">Live results</h1>
            <p className="page-sub">
              A bird's-eye view of every election — turnout, ballots, and the current leader.
            </p>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="live-chip">
              <span className="dot" /> {connected ? 'LIVE' : 'Reconnecting…'}
            </span>
            <span className="badge badge-neon">🗳 {liveCount} open</span>
          </div>
        </motion.div>

        {overview.length === 0 ? (
          <motion.div className="card empty" variants={fadeUp}>
            <span className="empty-icon">📊</span>
            <h3>Nothing to show yet</h3>
            <p>Results will appear here once elections are created.</p>
          </motion.div>
        ) : (
          <div className="grid grid-2">
            {overview.map((e, i) => (
              <motion.div
                key={e.id}
                className="card card-pad"
                variants={fadeUp}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -4, boxShadow: 'var(--shadow-lg)' }}
              >
                <div className="row-between" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <StatusBadge status={e.status} />
                    <span className="muted" style={{ fontSize: 12 }}>
                      {TYPE_ICON[e.type]} {e.type === 'candidate' ? 'Candidate' : 'Proposal'}
                    </span>
                  </div>
                  <Link to={`/elections/${e.id}/results`} className="btn btn-sm">
                    View →
                  </Link>
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>{e.title}</h3>

                <div className="stats-row" style={{ margin: '16px 0 0', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="card stat-card" style={{ padding: 12, boxShadow: 'none' }}>
                    <div className="stat-value" style={{ fontSize: 22 }}>
                      <AnimatedNumber value={e.voterCount} duration={900} delay={i * 0.07} />
                    </div>
                    <div className="stat-label">Ballots</div>
                  </div>
                  <div className="card stat-card" style={{ padding: 12, boxShadow: 'none' }}>
                    <div className="stat-value" style={{ fontSize: 22 }}>
                      <AnimatedNumber value={e.turnout} decimals={1} suffix="%" duration={900} delay={i * 0.07} />
                    </div>
                    <div className="stat-label">Turnout</div>
                  </div>
                </div>

                {e.lead ? (
                  <div className="voted-notice" style={{ marginTop: 12, fontSize: 13, padding: '10px 14px' }}>
                    👑 Leading: <strong>{e.lead.name}</strong>
                    {e.lead.position && <span className="muted"> · {e.lead.position}</span>}
                    <span style={{ marginLeft: 'auto' }}>
                      <AnimatedNumber value={e.lead.votes} duration={900} delay={i * 0.07} /> votes
                    </span>
                  </div>
                ) : (
                  <div className="card card-pad" style={{ marginTop: 12, padding: '10px 14px', boxShadow: 'none' }}>
                    <span className="muted" style={{ fontSize: 13 }}>No ballots cast yet.</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
