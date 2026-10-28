import { Router } from 'express';
import { z } from 'zod';
import { db, audit } from '../db.js';
import { recordAndBroadcastSecurityEvent } from '../securityCopilotService.js';
import { requireAuth } from '../middleware/auth.js';
import { voteLimiter } from '../middleware/rateLimiter.js';
import {
  getElection,
  effectiveStatus,
  computeResults,
} from '../electionService.js';
import { getIo } from '../io.js';

const router = Router();

const candidateVoteSchema = z.object({
  selections: z
    .array(
      z.object({
        positionId: z.number().int().positive(),
        candidateId: z.number().int().positive(),
      })
    )
    .min(1, 'You must select at least one candidate.')
    .max(50),
});

const proposalVoteSchema = z.object({
  optionId: z.number().int().positive(),
});

router.post('/:id/vote', requireAuth, voteLimiter, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid election id.' });

  const election = getElection(id);
  if (!election) return res.status(404).json({ error: 'Election not found.' });

  if (effectiveStatus(election) !== 'active') {
    return res.status(409).json({ error: 'This election is not open for voting.' });
  }

  let body;
  if (election.type === 'candidate') {
    const parsed = candidateVoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid ballot.', details: parsed.error.issues });
    }
    body = parsed.data;
  } else {
    const parsed = proposalVoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid ballot.', details: parsed.error.issues });
    }
    body = parsed.data;
  }

  const existing = db
    .prepare('SELECT COUNT(*) AS c FROM votes WHERE election_id = ? AND voter_id = ?')
    .get(id, req.user.id).c;
  if (existing > 0) {
    recordAndBroadcastSecurityEvent({
      userId: req.user.id,
      eventType: 'vote.duplicate_attempt',
      severity: 'MEDIUM',
      ip: req.ip,
      details: { electionId: id, reason: 'Duplicate vote attempt caught by app logic' }
    });
    return res.status(409).json({ error: 'You have already voted in this election.' });
  }

  const insertVote = db.prepare(
    'INSERT INTO votes (election_id, voter_id, position_id, candidate_id, option_id) VALUES (?, ?, ?, ?, ?)'
  );

  const runTransaction = () => {
    db.exec('BEGIN IMMEDIATE;');
    try {
      if (election.type === 'candidate') {
        const seenPositions = new Set();
        for (const sel of body.selections) {
          if (seenPositions.has(sel.positionId)) {
            throw Object.assign(new Error('Duplicate position selection.'), { code: 'DUP' });
          }
          seenPositions.add(sel.positionId);

          const position = db
            .prepare('SELECT * FROM positions WHERE id = ? AND election_id = ?')
            .get(sel.positionId, id);
          if (!position) {
            throw Object.assign(new Error('Invalid position.'), { code: 'VALIDATION' });
          }
          const candidate = db
            .prepare('SELECT * FROM candidates WHERE id = ? AND position_id = ?')
            .get(sel.candidateId, sel.positionId);
          if (!candidate) {
            throw Object.assign(new Error('Invalid candidate.'), { code: 'VALIDATION' });
          }

          insertVote.run(id, req.user.id, sel.positionId, sel.candidateId, null);
        }
      } else {
        const option = db
          .prepare('SELECT * FROM options WHERE id = ? AND election_id = ?')
          .get(body.optionId, id);
        if (!option) {
          throw Object.assign(new Error('Invalid option.'), { code: 'VALIDATION' });
        }
        insertVote.run(id, req.user.id, null, null, body.optionId);
      }
      db.exec('COMMIT;');
    } catch (err) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        /* already rolled back */
      }
      throw err;
    }
  };

  try {
    runTransaction();
  } catch (err) {
    if (err.code === 'VALIDATION') return res.status(400).json({ error: err.message });
    if (err.code === 'DUP') return res.status(400).json({ error: err.message });
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'You have already voted in this election.' });
    }
    throw err;
  }

  audit(req.user.id, 'vote.cast', `election ${id}`, req.ip);

  const io = getIo();
  if (io) {
    const results = computeResults(election);
    io.to(`election:${id}`).emit('vote:cast', {
      electionId: id,
      voterCount: results.voterCount,
      turnout: results.turnout,
    });
    io.to(`election:${id}`).emit('results:update', results);
    io.emit('overview:update', { electionId: id });
  }

  return res.status(201).json({ message: 'Vote recorded successfully.' });
});

export default router;
