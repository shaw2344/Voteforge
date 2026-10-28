import { motion } from 'framer-motion';
import AnimatedNumber from './AnimatedNumber.jsx';

export default function AnimatedBarList({ items, total, showWinner = false, colors = [], delayBase = 0 }) {
  return items.map((it, i) => {
    const pct = total > 0 ? (it.votes / total) * 100 : 0;
    const fillClass = colors[i % colors.length] || 'bar-fill';
    return (
      <motion.div
        key={it.id}
        className="mb-16"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delayBase + i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="row-between" style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
            {showWinner && it.winner && (
              <motion.span
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 16, delay: 0.5 }}
              >
                👑
              </motion.span>
            )}
            {it.name}
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            <AnimatedNumber value={it.votes} duration={1000} delay={delayBase + i * 0.06} /> votes ·{' '}
            {pct.toFixed(1)}%
          </span>
        </div>
        <div className="bar-track">
          <motion.div
            className={`bar-fill ${fillClass}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: delayBase + 0.08 + i * 0.06 }}
          />
        </div>
      </motion.div>
    );
  });
}
