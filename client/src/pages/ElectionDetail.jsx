import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, errorMessage } from '../api.js';
import { formatDate, timeLeft } from '../utils.js';
import StatusBadge from '../components/StatusBadge.jsx';
import VoteForm from '../components/VoteForm.jsx';
import VotedSuccess from '../components/VotedSuccess.jsx';
import { staggerContainer, fadeUp } from '../motion.js';

export default function ElectionDetail() {
  const { id } = useParams();
  const [election, setElection] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    return Promise.all([api.get(`/elections/${id}`), api.get(`/elections/${id}/my-vote`)])
      .then(([eRes, vRes]) => {
        setElection(eRes.data.election);
        setMyVote(vRes.data);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onVoted = useCallback(async () => {
    const vRes = await api.get(`/elections/${id}/my-vote`);
    setMyVote(vRes.data);
  }, [id]);

  if (error) {
    return (
      <div className="container">
        <div className="form-error">{error}</div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="container">
        <div className="page-center">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const status = election.status;

  return (
    <div className="container">
      <motion.div variants={staggerContainer(0.1)} initial="hidden" animate="show">
        <motion.div className="row flex-wrap mb-16" variants={fadeUp} style={{ gap: 10 }}>
          <Link to="/" className="btn btn-sm">
            ← Back
          </Link>
          <Link to={`/elections/${election.id}/results`} className="btn btn-sm btn-primary">
            📊 Live results
          </Link>
          {status === 'active' && (
            <span className="live-chip" style={{ marginLeft: 'auto' }}>
              <span className="dot" /> LIVE
            </span>
          )}
        </motion.div>

        <motion.div className="page-header" variants={fadeUp}>
          <div>
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <StatusBadge status={status} />
              <span className="badge badge-draft">
                {election.type === 'candidate' ? 'Candidate ballot' : 'Proposal ballot'}
              </span>
            </div>
            <h1 className="page-title solid">{election.title}</h1>
            <p className="page-sub">{election.description || 'No description provided.'}</p>
          </div>
        </motion.div>

        <motion.div className="card card-pad mb-16" variants={fadeUp}>
          <div className="election-meta" style={{ marginBottom: 0 }}>
            <span>🗓 Opens {formatDate(election.startsAt)}</span>
            <span>🏁 Closes {formatDate(election.endsAt)}</span>
            <span style={{ fontWeight: 600 }}>⏳ {timeLeft(election.endsAt)}</span>
            <span>🗳 {election.voterCount} ballots cast</span>
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          {status !== 'active' && (
            <div className="card card-pad mb-16">
              <div className="form-error" style={{ marginBottom: 0 }}>
                {status === 'upcoming' && 'This election has not opened yet. Voting is disabled.'}
                {status === 'draft' && 'This election is still in draft. Voting is disabled.'}
                {status === 'closed' && 'This election has closed. Voting is no longer possible.'}
              </div>
            </div>
          )}

          {status === 'active' &&
            (myVote?.voted ? (
              <VotedSuccess />
            ) : (
              <div className="card card-pad">
                <h2 className="card-title">Vote now</h2>
                <p className="card-sub">Choose one candidate per position. Your ballot is final once submitted.</p>
                <VoteForm election={election} onVoted={onVoted} />
              </div>
            ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
