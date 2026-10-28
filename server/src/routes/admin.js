import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, publicUser, audit, toIso } from '../db.js';
import config from '../config.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getElection, summary, computeResults } from '../electionService.js';
import { getIo } from '../io.js';

const router = Router();

router.use(requireAuth, requireAdmin);

const candidateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(1000).optional().default(''),
});

const positionSchema = z.object({
  title: z.string().trim().min(1).max(100),
  candidates: z.array(candidateSchema).min(2, 'Each position needs at least 2 candidates.'),
});

const optionSchema = z.object({
  text: z.string().trim().min(1).max(200),
});

const createElectionSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(150),
  description: z.string().trim().max(3000).optional().default(''),
  type: z.enum(['candidate', 'proposal']),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  status: z.enum(['draft', 'active']).optional().default('draft'),
  positions: z.array(positionSchema).optional(),
  options: z.array(optionSchema).min(2, 'Proposal elections need at least 2 options.').optional(),
});

function toDbTime(iso) {
  return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
}

function isValidDate(s) {
  return !Number.isNaN(new Date(s).getTime());
}

router.get('/elections', (req, res) => {
  const rows = db.prepare('SELECT * FROM elections ORDER BY created_at DESC, id DESC').all();
  return res.json({
    elections: rows.map((e) => {
      const candidates = db
        .prepare(
          `SELECT COUNT(*) AS c FROM candidates c JOIN positions p ON c.position_id = p.id WHERE p.election_id = ?`
        )
        .get(e.id).c;
      return { ...summary(e), candidateCount: candidates, storedStatus: e.status };
    }),
  });
});

router.post('/elections', validate(createElectionSchema), (req, res) => {
  const data = req.body;

  if (!isValidDate(data.startsAt) || !isValidDate(data.endsAt)) {
    return res.status(400).json({ error: 'Invalid dates.' });
  }
  if (new Date(data.endsAt).getTime() <= new Date(data.startsAt).getTime()) {
    return res.status(400).json({ error: 'endsAt must be after startsAt.' });
  }
  if (data.type === 'candidate' && (!data.positions || data.positions.length === 0)) {
    return res.status(400).json({ error: 'Candidate elections need at least one position.' });
  }
  if (data.type === 'proposal' && (!data.options || data.options.length < 2)) {
    return res.status(400).json({ error: 'Proposal elections need at least two options.' });
  }

  const result = db
    .prepare(
      `INSERT INTO elections (title, description, type, starts_at, ends_at, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.title,
      data.description,
      data.type,
      toDbTime(data.startsAt),
      toDbTime(data.endsAt),
      data.status,
      req.user.id
    );
  const electionId = result.lastInsertRowid;

  if (data.type === 'candidate') {
    const insPosition = db.prepare(
      'INSERT INTO positions (election_id, title, sort_order) VALUES (?, ?, ?)'
    );
    const insCandidate = db.prepare(
      'INSERT INTO candidates (position_id, name, bio, sort_order) VALUES (?, ?, ?, ?)'
    );
    data.positions.forEach((p, pi) => {
      const pResult = insPosition.run(electionId, p.title, pi);
      p.candidates.forEach((c, ci) => insCandidate.run(pResult.lastInsertRowid, c.name, c.bio, ci));
    });
  } else {
    const insOption = db.prepare(
      'INSERT INTO options (election_id, text, sort_order) VALUES (?, ?, ?)'
    );
    data.options.forEach((o, i) => insOption.run(electionId, o.text, i));
  }

  audit(req.user.id, 'election.create', `election #${electionId} "${data.title}"`, req.ip);
  return res.status(201).json({ election: summary(getElection(electionId)) });
});

const updateSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(3000).optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

router.patch('/elections/:id', validate(updateSchema), (req, res) => {
  const id = Number(req.params.id);
  const election = getElection(id);
  if (!election) return res.status(404).json({ error: 'Election not found.' });

  const fields = [];
  const values = [];
  if (req.body.title !== undefined) {
    fields.push('title = ?');
    values.push(req.body.title);
  }
  if (req.body.description !== undefined) {
    fields.push('description = ?');
    values.push(req.body.description);
  }
  if (req.body.startsAt !== undefined) {
    if (!isValidDate(req.body.startsAt)) return res.status(400).json({ error: 'Invalid startsAt.' });
    fields.push('starts_at = ?');
    values.push(toDbTime(req.body.startsAt));
  }
  if (req.body.endsAt !== undefined) {
    if (!isValidDate(req.body.endsAt)) return res.status(400).json({ error: 'Invalid endsAt.' });
    fields.push('ends_at = ?');
    values.push(toDbTime(req.body.endsAt));
  }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

  if (
    (req.body.startsAt && req.body.endsAt && new Date(req.body.endsAt) <= new Date(req.body.startsAt)) ||
    (req.body.startsAt && !req.body.endsAt && new Date(toIso(election.ends_at)) <= new Date(req.body.startsAt)) ||
    (!req.body.startsAt && req.body.endsAt && new Date(req.body.endsAt) <= new Date(toIso(election.starts_at)))
  ) {
    return res.status(400).json({ error: 'endsAt must be after startsAt.' });
  }

  values.push(id);
  db.prepare(`UPDATE elections SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  audit(req.user.id, 'election.update', `election #${id}`, req.ip);
  return res.json({ election: summary(getElection(id)) });
});

const statusSchema = z.object({
  status: z.enum(['draft', 'active', 'closed']),
});

router.post('/elections/:id/status', validate(statusSchema), (req, res) => {
  const id = Number(req.params.id);
  const election = getElection(id);
  if (!election) return res.status(404).json({ error: 'Election not found.' });

  const { status } = req.body;
  if (status === 'active' && election.status !== 'draft') {
    return res.status(409).json({ error: 'Only draft elections can be activated.' });
  }
  if (status === 'closed') {
    // closing is always allowed
  }
  if (status === 'draft' && election.status === 'closed') {
    return res.status(409).json({ error: 'A closed election cannot be reopened.' });
  }

  db.prepare('UPDATE elections SET status = ? WHERE id = ?').run(status, id);
  audit(req.user.id, 'election.status', `election #${id} -> ${status}`, req.ip);

  const io = getIo();
  if (io) io.to(`election:${id}`).emit('election:status', { electionId: id, status });

  return res.json({ election: summary(getElection(id)) });
});

router.delete('/elections/:id', (req, res) => {
  const id = Number(req.params.id);
  const election = getElection(id);
  if (!election) return res.status(404).json({ error: 'Election not found.' });
  db.prepare('DELETE FROM elections WHERE id = ?').run(id);
  audit(req.user.id, 'election.delete', `election #${id}`, req.ip);
  return res.status(204).end();
});

router.get('/users', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC, id DESC LIMIT 500').all();
  return res.json({ users: rows.map(publicUser) });
});

router.get('/stats', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const elections = db.prepare('SELECT COUNT(*) AS c FROM elections').get().c;
  const votes = db.prepare('SELECT COUNT(*) AS c FROM votes').get().c;
  const simulated = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_simulated = 1').get().c;
  return res.json({ stats: { users, elections, votes, simulated } });
});

router.get('/audit', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const total = db.prepare('SELECT COUNT(*) AS c FROM audit_log').get().c;
  const rows = db
    .prepare(
      `SELECT a.*, u.student_id AS user_student_id, u.name AS user_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);
  return res.json({
    total,
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      detail: r.detail,
      ip: r.ip,
      createdAt: toIso(r.created_at),
      user: r.user_id ? { id: r.user_id, studentId: r.user_student_id, name: r.user_name } : null,
    })),
  });
});

const simulateSchema = z.object({
  voterCount: z
    .number()
    .int()
    .min(1, 'At least 1 simulated voter required.')
    .max(config.simulation.maxVoters, `Maximum ${config.simulation.maxVoters} voters.`),
});

const SIM_FIRST_NAMES = [
  'Amara', 'Liam', 'Sofia', 'Noah', 'Priya', 'Ethan', 'Maya', 'Lucas',
  'Aisha', 'Daniel', 'Chloe', 'Kofi', 'Hana', 'Mateo', 'Zara', 'Omar',
  'Lina', 'Ravi', 'Nina', 'Theo', 'Iris', 'Jonah', 'Leila', 'Aiden',
];
const SIM_LAST_NAMES = [
  'Brooks', 'Chen', 'Nakamura', 'Okafor', 'Silva', 'Kowalski', 'Nguyen',
  'Ahmed', 'Moreau', 'Ivanov', 'Park', 'Costa', 'Haddad', 'Lindgren',
];

router.post('/elections/:id/simulate', validate(simulateSchema), async (req, res) => {
  const id = Number(req.params.id);
  const election = getElection(id);
  if (!election) return res.status(404).json({ error: 'Election not found.' });

  const voterCount = req.body.voterCount;
  const seedPrefix = `SIM${Math.floor(Date.now() / 1000) % 1000000}`;

  const passwordHash = await bcrypt.hash('Sim@2026!x', config.security.bcryptRounds);
  const insUser = db.prepare(
    `INSERT INTO users (student_id, name, email, password_hash, role, is_simulated)
     VALUES (?, ?, ?, ?, 'student', 1)`
  );
  const insertVote = db.prepare(
    'INSERT INTO votes (election_id, voter_id, position_id, candidate_id, option_id) VALUES (?, ?, ?, ?, ?)'
  );

  let candidatesByPosition = [];
  let options = [];
  if (election.type === 'candidate') {
    candidatesByPosition = db
      .prepare('SELECT * FROM positions WHERE election_id = ? ORDER BY sort_order, id')
      .all(id)
      .map((p) => ({
        positionId: p.id,
        candidates: db
          .prepare('SELECT id FROM candidates WHERE position_id = ? ORDER BY sort_order, id')
          .all(p.id)
          .map((c) => c.id),
      }));
  } else {
    options = db.prepare('SELECT id FROM options WHERE election_id = ? ORDER BY sort_order, id').all(id).map((o) => o.id);
  }

  if (
    (election.type === 'candidate' && candidatesByPosition.length === 0) ||
    (election.type === 'proposal' && options.length === 0)
  ) {
    return res.status(400).json({ error: 'Election has no ballot items configured.' });
  }

  let createdUsers = 0;
  let createdVotes = 0;
  const seen = new Set();

  for (let i = 0; i < voterCount; i++) {
    const studentId = `${seedPrefix}-${String(i).padStart(4, '0')}`;
    if (db.prepare('SELECT id FROM users WHERE student_id = ?').get(studentId)) continue;
    const first = SIM_FIRST_NAMES[i % SIM_FIRST_NAMES.length];
    const last = SIM_LAST_NAMES[(i * 7) % SIM_LAST_NAMES.length];
    const userResult = insUser.run(
      studentId,
      `${first} ${last}`,
      `${first.toLowerCase()}.${studentId.toLowerCase()}@voteforge.local`,
      passwordHash
    );
    createdUsers++;
    const voterId = userResult.lastInsertRowid;

    db.exec('BEGIN IMMEDIATE;');
    try {
      if (election.type === 'candidate') {
        for (const pos of candidatesByPosition) {
          const pick = pos.candidates[Math.floor(Math.random() * pos.candidates.length)];
          insertVote.run(id, voterId, pos.positionId, pick, null);
          createdVotes++;
        }
      } else {
        const pick = options[Math.floor(Math.random() * options.length)];
        insertVote.run(id, voterId, null, null, pick);
        createdVotes++;
      }
      db.exec('COMMIT;');
    } catch {
      try {
        db.exec('ROLLBACK;');
      } catch {
        /* ignore */
      }
    }
    seen.add(voterId);
  }

  audit(req.user.id, 'simulation.run', `election #${id}, ${voterCount} voters`, req.ip);

  const io = getIo();
  if (io) {
    io.to(`election:${id}`).emit('results:update', computeResults(election));
    io.to(`election:${id}`).emit('simulation:done', {
      electionId: id,
      createdUsers,
      createdVotes,
    });
    io.emit('overview:update', { electionId: id });
  }

  return res.json({ createdUsers, createdVotes, election: summary(election) });
});

export default router;
