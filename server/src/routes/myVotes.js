import { Router } from 'express';
import { db, toIso } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT v.*, e.title AS election_title, e.type AS election_type,
              p.title AS position_title, c.name AS candidate_name, o.text AS option_text
       FROM votes v
       JOIN elections e ON e.id = v.election_id
       LEFT JOIN positions p ON p.id = v.position_id
       LEFT JOIN candidates c ON c.id = v.candidate_id
       LEFT JOIN options o ON o.id = v.option_id
       WHERE v.voter_id = ?
       ORDER BY v.created_at DESC, v.id DESC`
    )
    .all(req.user.id);

  const byElection = new Map();
  for (const r of rows) {
    if (!byElection.has(r.election_id)) {
      byElection.set(r.election_id, {
        electionId: r.election_id,
        electionTitle: r.election_title,
        type: r.election_type,
        createdAt: toIso(r.created_at),
        choices: [],
      });
    }
    const ballot = byElection.get(r.election_id);
    if (r.election_type === 'candidate') {
      ballot.choices.push({ position: r.position_title, candidate: r.candidate_name });
    } else {
      ballot.choices.push({ option: r.option_text });
    }
  }

  return res.json({ ballots: [...byElection.values()] });
});

export default router;
