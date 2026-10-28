import { motion } from 'framer-motion';
import { fadeUp, staggerContainer } from '../motion.js';
import BallotScene from './BallotScene.jsx';

const FEATURES = [
  'One person, one vote — enforced at the database level',
  'Candidate elections and proposal ballots',
  'Real-time results with live 3D visualizations',
  'Full simulation engine for academic testing',
];

export default function AuthShell({ title, subtitle, children, footnote }) {
  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      <div className="auth-shell">
        <motion.div
          className="auth-hero"
          variants={staggerContainer(0.12)}
          initial="hidden"
          animate="show"
        >
          <BallotScene />
          <motion.p variants={fadeUp} className="muted" style={{ fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 12 }}>
            Academic Voting Simulation
          </motion.p>
          <motion.h1 variants={fadeUp} className="hero-title">
            Your voice, <span className="grad-text">scored in 3D.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="hero-copy">
            VoteForge runs secure candidate and proposal elections for your institution — with live
            motion-graphic results, instant simulations, and an audit trail behind everything.
          </motion.p>
          <motion.div variants={fadeUp} className="hero-features">
            {FEATURES.map((f) => (
              <div key={f} className="hero-feature">
                <span className="check">✓</span> {f}
              </div>
            ))}
          </motion.div>
        </motion.div>

        <div className="auth-form-col">
          <motion.div
            className="card auth-card"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          >
            <h2>{title}</h2>
            <p className="page-sub">{subtitle}</p>
            {children}
            {footnote && <p className="auth-footnote">{footnote}</p>}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
