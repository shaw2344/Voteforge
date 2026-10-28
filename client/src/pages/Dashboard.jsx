import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, errorMessage } from '../api.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { staggerContainer, fadeUp } from '../motion.js';
import ElectionCard from '../components/ElectionCard.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [elections, setElections] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/elections')
      .then((res) => setElections(res.data.elections))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) {
    return (
      <div className="container">
        <div className="form-error">{error}</div>
      </div>
    );
  }

  const activeCount = elections?.filter((e) => e.status === 'active').length ?? null;

  return (
    <div className="container">
      <motion.div
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="show"
        className="page-header"
      >
        <div>
          <motion.h1 variants={fadeUp} className="page-title">
            Hello, {user.name.split(' ')[0]}
          </motion.h1>
          <motion.p variants={fadeUp} className="page-sub">
            {activeCount !== null && activeCount > 0
              ? `There ${activeCount === 1 ? 'is 1 election' : `are ${activeCount} elections`} open for voting right now.`
              : 'No elections are currently open. Check back soon.'}
          </motion.p>
        </div>
        <motion.div variants={fadeUp} className="badge badge-neon" style={{ alignSelf: 'flex-start' }}>
          🗳 {activeCount !== null ? `${activeCount} live` : '…'}
        </motion.div>
      </motion.div>

      {!elections ? (
        <div className="page-center">
          <div className="spinner" />
        </div>
      ) : elections.length === 0 ? (
        <motion.div className="card empty" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <span className="empty-icon">🗳️</span>
          <h3>No elections yet</h3>
          <p>An administrator needs to create an election. Watch this space.</p>
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-2"
          variants={staggerContainer(0.09)}
          initial="hidden"
          animate="show"
        >
          {elections.map((e, i) => (
            <ElectionCard key={e.id} election={e} index={i} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
