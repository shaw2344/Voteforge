import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { api, errorMessage } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import AnimatedBarList from '../components/AnimatedBarList.jsx';
import DonutChart from '../components/DonutChart.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import { statusLabel } from '../utils.js';
import { staggerContainer, fadeUp, scaleIn } from '../motion.js';

const FILL_CLASSES = ['bar-fill violet', 'bar-fill cyan', 'bar-fill green', 'bar-fill amber', 'bar-fill rose', 'bar-fill pink', 'bar-fill teal', 'bar-fill sky'];
const DOT_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

export default function Results() {
  const { id } = useParams();
  const [results, setResults] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastVote, setLastVote] = useState(null);
  const [error, setError] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    api
      .get(`/elections/${id}/results`)
      .then((res) => setResults(res.data.results))
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => {
    const socket = io({ withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join:election', Number(id));
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('results:update', (data) => {
      if (data && data.electionId === Number(id)) {
        setResults((prev) => (prev ? { ...data, spark: (prev.spark || 0) + 1 } : data));
      }
    });
    socket.on('vote:cast', (data) => {
      if (data?.electionId === Number(id)) {
        setLastVote({ voterCount: data.voterCount, at: Date.now() });
      }
    });
    socket.on('election:status', (data) => {
      if (data?.electionId === Number(id)) {
        setResults((r) => (r ? { ...r, status: data.status } : r));
      }
    });
    return () => {
      socket.emit('leave:election', Number(id));
      socket.disconnect();
    };
  }, [id]);

  if (error) {
    return (
      <div className="container">
        <div className="form-error">{error}</div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="container">
        <div className="page-center">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <motion.div
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="show"
      >
        <motion.div className="row flex-wrap mb-16" variants={fadeUp} style={{ gap: 10 }}>
          <Link to={`/elections/${id}`} className="btn btn-sm">
            ← Back to election
          </Link>
          <span className={`live-chip ${connected ? '' : 'badge-draft'}`}>
            <span className="dot" />
            {connected ? 'LIVE' : 'Reconnecting…'}
          </span>
          <AnimatePresence>
            {lastVote && (
              <motion.span
                key={lastVote.at}
                className="badge badge-neon"
                initial={{ opacity: 0, y: -10, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              >
                ⚡ Ballot {lastVote.voterCount} just landed
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div className="page-header" variants={fadeUp}>
          <div>
            <h1 className="page-title solid">Live results</h1>
            <p className="page-sub">
              Status: <StatusBadge status={results.status} /> — updated the instant a ballot is cast.
            </p>
          </div>
        </motion.div>

        <motion.div className="stats-row" variants={fadeUp}>
          <motion.div className="card stat-card" variants={scaleIn}>
            <div className="stat-value">
              <AnimatedNumber value={results.voterCount} duration={1200} />
            </div>
            <div className="stat-label">Ballots cast</div>
          </motion.div>
          <motion.div className="card stat-card" variants={scaleIn}>
            <div className="stat-value">
              <AnimatedNumber value={results.registeredVoters} duration={1200} delay={0.1} />
            </div>
            <div className="stat-label">Registered voters</div>
          </motion.div>
          <motion.div className="card stat-card" variants={scaleIn}>
            <div className="stat-value">
              <AnimatedNumber value={results.turnout} decimals={1} suffix="%" duration={1200} delay={0.2} />
            </div>
            <div className="stat-label">Turnout</div>
          </motion.div>
          <motion.div className="card stat-card" variants={scaleIn}>
            <div className="stat-value" style={{ fontSize: 24, paddingTop: 4 }}>
              {statusLabel(results.status)}
            </div>
            <div className="stat-label">Election state</div>
          </motion.div>
        </motion.div>

        {results.type === 'candidate' ? (
          <div className="stack">
            {results.positions.map((position, pi) => {
              const leading = position.total > 0
                ? [...position.candidates].sort((a, b) => b.votes - a.votes)[0]
                : null;
              return (
                <motion.div key={position.id} className="card chart-card" variants={fadeUp}>
                  <div className="row-between">
                    <h2 className="chart-title">{position.title}</h2>
                    <span className="muted" style={{ fontSize: 13 }}>
                      <AnimatedNumber value={position.total} duration={900} delay={pi * 0.1} /> votes
                    </span>
                  </div>
                  {leading && position.total > 0 && (
                    <motion.div
                      className="voted-notice mb-16"
                      style={{ fontSize: 13 }}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      👑 Leading: <strong>{leading.name}</strong>
                    </motion.div>
                  )}
                  <AnimatedBarList
                    items={position.candidates}
                    total={position.total}
                    showWinner
                    colors={FILL_CLASSES}
                    delayBase={pi * 0.1}
                  />
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div className="grid grid-2" variants={fadeUp}>
            <div className="card chart-card">
              <h2 className="chart-title">Share of votes</h2>
              <DonutChart items={results.options} />
            </div>
            <div className="card chart-card">
              <h2 className="chart-title">Tally</h2>
              {results.options.map((o, i) => (
                <div key={o.id} className="row" style={{ marginBottom: 12, gap: 10 }}>
                  <span className="legend-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                  <span style={{ fontWeight: 600, flex: 1 }}>{o.text}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    <AnimatedNumber value={o.votes} duration={800} delay={i * 0.08} /> · {o.pct}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
