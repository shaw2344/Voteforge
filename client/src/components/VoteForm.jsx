import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, errorMessage } from '../api.js';

export default function VoteForm({ election, onVoted }) {
  const [selections, setSelections] = useState(() => {
    if (election.type === 'candidate') {
      const initial = {};
      election.positions.forEach((p) => (initial[p.id] = null));
      return initial;
    }
    return { optionId: null };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const positionValues = Object.values(selections).filter((v) => v != null);
  const totalPositions = election.type === 'candidate' ? election.positions.length : 1;
  const progress = (positionValues.length / totalPositions) * 100;

  const canSubmit = totalPositions > 0 && positionValues.length === totalPositions;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload =
        election.type === 'candidate'
          ? {
              selections: Object.entries(selections).map(([positionId, candidateId]) => ({
                positionId: Number(positionId),
                candidateId,
              })),
            }
          : { optionId: selections.optionId };
      await api.post(`/elections/${election.id}/vote`, payload);
      onVoted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      {error && (
        <motion.div className="form-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          {error}
        </motion.div>
      )}

      {/* progress */}
      <div className="row mb-16">
        <div className="bar-track" style={{ height: 8, flex: 1 }}>
          <motion.div
            className="bar-fill"
            style={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          {positionValues.length}/{totalPositions} decided
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {election.type === 'candidate' ? (
          election.positions.map((position, pi) => (
            <motion.div
              key={position.id}
              className="position-block"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: pi * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3>
                <span className="badge badge-student" style={{ letterSpacing: 0 }}>
                  {String(pi + 1).padStart(2, '0')}
                </span>
                {position.title}
              </h3>
              {position.candidates.map((c) => {
                const selected = selections[position.id] === c.id;
                return (
                  <motion.label
                    key={c.id}
                    className={`candidate-option ${selected ? 'selected' : ''}`}
                    whileHover={{ x: 4 }}
                    layout
                  >
                    <input
                      type="radio"
                      name={`position-${position.id}`}
                      checked={selected}
                      onChange={() => setSelections((s) => ({ ...s, [position.id]: c.id }))}
                    />
                    <span style={{ flex: 1 }}>
                      <span className="candidate-name">{c.name}</span>
                      {c.bio && <div className="candidate-bio">{c.bio}</div>}
                    </span>
                    {selected && (
                      <motion.span
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                        style={{ fontSize: 18 }}
                      >
                        ✓
                      </motion.span>
                    )}
                  </motion.label>
                );
              })}
            </motion.div>
          ))
        ) : (
          <motion.div className="position-block" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <h3>Your choice</h3>
            {election.options.map((o) => {
              const selected = selections.optionId === o.id;
              return (
                <motion.label
                  key={o.id}
                  className={`candidate-option ${selected ? 'selected' : ''}`}
                  whileHover={{ x: 4 }}
                  layout
                >
                  <input
                    type="radio"
                    name="option"
                    checked={selected}
                    onChange={() => setSelections((s) => ({ ...s, optionId: o.id }))}
                  />
                  <span className="candidate-name" style={{ flex: 1 }}>
                    {o.text}
                  </span>
                  {selected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                      style={{ fontSize: 18 }}
                    >
                      ✓
                    </motion.span>
                  )}
                </motion.label>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="row-between mt-24">
        <motion.button
          className="btn btn-primary"
          type="submit"
          disabled={busy || !canSubmit}
          whileHover={canSubmit && !busy ? { scale: 1.03 } : undefined}
          whileTap={{ scale: 0.97 }}
        >
          {busy ? 'Sealing your ballot…' : election.type === 'candidate' ? 'Submit my ballot' : 'Cast my vote'}
        </motion.button>
        <span className="muted" style={{ fontSize: 13 }}>
          One vote per position · cannot be changed after submission
        </span>
      </div>
    </form>
  );
}
