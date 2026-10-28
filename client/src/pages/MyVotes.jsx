import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, errorMessage } from '../api.js';
import { formatDate } from '../utils.js';
import { staggerContainer, fadeUp } from '../motion.js';

export default function MyVotes() {
  const [ballots, setBallots] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/votes/me')
      .then((res) => setBallots(res.data.ballots))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) {
    return (
      <div className="container">
        <div className="form-error">{error}</div>
      </div>
    );
  }

  if (!ballots) {
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
      <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="show">
        <motion.div className="page-header" variants={fadeUp}>
          <div>
            <h1 className="page-title">My votes</h1>
            <p className="page-sub">
              {ballots.length === 0
                ? 'You have not voted in any election yet.'
                : `You have cast ${ballots.length} ballot${ballots.length === 1 ? '' : 's'} so far.`}
            </p>
          </div>
        </motion.div>

        {ballots.length === 0 ? (
          <motion.div className="card empty" variants={fadeUp}>
            <span className="empty-icon">🧾</span>
            <h3>No ballots yet</h3>
            <p>
              When you vote, your selections will be recorded here for your own reference.{' '}
              <Link to="/">Browse elections</Link>
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-2">
            {ballots.map((b, i) => (
              <motion.div
                key={b.electionId}
                className="card card-pad"
                variants={fadeUp}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -4, boxShadow: 'var(--shadow-lg)' }}
              >
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <span className="badge badge-student">
                    {b.type === 'candidate' ? '👥 Candidate ballot' : '📋 Proposal ballot'}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {formatDate(b.createdAt)}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 12px', fontSize: 17 }}>{b.electionTitle}</h3>
                <div className="stack" style={{ gap: 8 }}>
                  {b.choices.map((c, ci) => (
                    <motion.div
                      key={ci}
                      className="row"
                      style={{
                        gap: 10,
                        padding: '9px 12px',
                        borderRadius: 10,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                      }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + ci * 0.06 }}
                    >
                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
                      {b.type === 'candidate' ? (
                        <span style={{ fontSize: 13 }}>
                          <span className="muted">{c.position}:</span>{' '}
                          <strong>{c.candidate}</strong>
                        </span>
                      ) : (
                        <strong style={{ fontSize: 13 }}>{c.option}</strong>
                      )}
                    </motion.div>
                  ))}
                </div>
                <div className="mt-16">
                  <Link to={`/elections/${b.electionId}/results`} className="btn btn-sm">
                    View results →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
