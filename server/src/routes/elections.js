import { Router } from 'express';
import { db, toIso } from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { getDetail, computeResults, getElection, effectiveStatus, computeOverview } from '../electionService.js';

const router = Router();

router.get('/', optionalAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM elections ORDER BY starts_at DESC, id DESC').all();
  const list = rows.map((e) => {
    const voterCount =
      db.prepare('SELECT COUNT(DISTINCT voter_id) AS c FROM votes WHERE election_id = ?').get(e.id)
        .c ?? 0;
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      type: e.type,
      startsAt: toIso(e.starts_at),
      endsAt: toIso(e.ends_at),
      status: effectiveStatus(e),
      voterCount,
    };
  });
  return res.json({ elections: list });
});

router.get('/overview', (req, res) => {
  return res.json({ overview: computeOverview() });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid election id.' });
  const detail = getDetail(id);
  if (!detail) return res.status(404).json({ error: 'Election not found.' });
  return res.json({ election: detail });
});

router.get('/:id/results', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid election id.' });
  const election = getElection(id);
  if (!election) return res.status(404).json({ error: 'Election not found.' });
  return res.json({ results: computeResults(election) });
});

router.get('/:id/my-vote', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid election id.' });
  const election = getElection(id);
  if (!election) return res.status(404).json({ error: 'Election not found.' });

  const votes = db
    .prepare(
      `SELECT position_id, candidate_id, option_id, created_at FROM votes
       WHERE election_id = ? AND voter_id = ?`
    )
    .all(id, req.user.id);

  return res.json({
    voted: votes.length > 0,
    votes: votes.map((v) => ({
      positionId: v.position_id,
      candidateId: v.candidate_id,
      optionId: v.option_id,
      createdAt: toIso(v.created_at),
    })),
  });
});

export default router;
