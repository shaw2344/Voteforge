import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDate, timeLeft } from '../utils.js';
import StatusBadge from './StatusBadge.jsx';
import TiltCard from './TiltCard.jsx';
import AnimatedNumber from './AnimatedNumber.jsx';
import { listItem } from '../motion.js';

const TYPE_ICON = {
  candidate: '👥',
  proposal: '📋',
};

export default function ElectionCard({ election, index = 0 }) {
  const delay = Math.min(index * 0.08, 0.6);

  return (
    <motion.div variants={listItem} custom={index} layout>
      <TiltCard>
        <Link to={`/elections/${election.id}`} className="election-card">
          <div className="row-between" style={{ marginBottom: 12 }}>
            <StatusBadge status={election.status} />
            <span className="badge badge-draft">
              {TYPE_ICON[election.type]} {election.type === 'candidate' ? 'Candidate' : 'Proposal'}
            </span>
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>{election.title}</h3>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13, minHeight: 38 }}>
            {election.description || 'No description provided.'}
          </p>
          <div className="election-meta" style={{ marginBottom: 0 }}>
            <span>🗓 {formatDate(election.startsAt)}</span>
            <span>🏁 {timeLeft(election.endsAt)}</span>
            <span style={{ fontWeight: 600 }}>
              🗳{' '}
              <AnimatedNumber value={election.voterCount} duration={900} delay={delay} />
              {election.voterCount === 1 ? ' ballot' : ' ballots'}
            </span>
          </div>
        </Link>
      </TiltCard>
    </motion.div>
  );
}
