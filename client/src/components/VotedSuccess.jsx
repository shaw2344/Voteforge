import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { fireVoteConfetti } from './Confetti.jsx';

export default function VotedSuccess() {
  useEffect(() => {
    fireVoteConfetti();
  }, []);

  return (
    <motion.div
      className="voted-notice"
      initial={{ opacity: 0, scale: 0.9, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
    >
      <motion.span
        className="check-burst"
        initial={{ scale: 0, rotate: -40 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.1 }}
      >
        ✓
      </motion.span>
      <div>
        <strong style={{ fontSize: 16 }}>Your ballot has been recorded.</strong>
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          Thank you for voting — you can now watch the results come in live.
        </div>
      </div>
    </motion.div>
  );
}
