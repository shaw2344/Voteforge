import bcrypt from 'bcryptjs';
import config from '../src/config.js';
import { db, migrate, nowUtc, audit } from '../src/db.js';

const ADMIN_STUDENT_ID = process.env.ADMIN_STUDENT_ID || 'admin';
const ADMIN_NAME = process.env.ADMIN_NAME || 'System Administrator';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@voteforge.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2026';

const STUDENT_STUDENT_ID = process.env.STUDENT_STUDENT_ID || 'student001';
const STUDENT_NAME = process.env.STUDENT_NAME || 'Demo Student';
const STUDENT_EMAIL = process.env.STUDENT_EMAIL || 'student@voteforge.local';
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD || 'Student@2026';

async function upsertUser({ studentId, name, email, password, role, simulated }) {
  const existing = db.prepare('SELECT id FROM users WHERE student_id = ?').get(studentId);
  if (existing) {
    console.log(`[seed] user already exists: ${studentId}`);
    return existing.id;
  }
  const hash = await bcrypt.hash(password, config.security.bcryptRounds);
  const result = db
    .prepare(
      `INSERT INTO users (student_id, name, email, password_hash, role, is_simulated)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(studentId, name, email, hash, role, simulated ? 1 : 0);
  console.log(`[seed] created user: ${studentId} (${role})`);
  return result.lastInsertRowid;
}

function demoElection() {
  const existing = db.prepare(`SELECT id FROM elections WHERE title = ?`).get('Student Council Election 2026');
  if (existing) {
    console.log('[seed] demo election already exists.');
    return;
  }
  const start = nowUtc();
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const result = db
    .prepare(
      `INSERT INTO elections (title, description, type, starts_at, ends_at, status, created_by)
       VALUES (?, ?, 'candidate', ?, ?, 'active', ?)`
    )
    .run(
      'Student Council Election 2026',
      'Vote for your student council representatives for the 2026 academic year. One vote per position.',
      start,
      end,
      null
    );
  const electionId = result.lastInsertRowid;

  const insPosition = db.prepare(
    'INSERT INTO positions (election_id, title, sort_order) VALUES (?, ?, ?)'
  );
  const insCandidate = db.prepare(
    'INSERT INTO candidates (position_id, name, bio, sort_order) VALUES (?, ?, ?, ?)'
  );

  const president = insPosition.run(electionId, 'President', 0);
  insCandidate.run(president.lastInsertRowid, 'Amara Chen', 'Focused on student well-being and campus innovation.', 0);
  insCandidate.run(president.lastInsertRowid, 'Liam Brooks', 'Building bridges between students and faculty.', 1);
  insCandidate.run(president.lastInsertRowid, 'Sofia Nguyen', 'Transparency, accountability, and student voice.', 2);

  const treasurer = insPosition.run(electionId, 'Treasurer', 1);
  insCandidate.run(treasurer.lastInsertRowid, 'Noah Silva', 'Sound financial planning for student activities.', 0);
  insCandidate.run(treasurer.lastInsertRowid, 'Priya Patel', 'Making every student dollar count.', 1);
  insCandidate.run(treasurer.lastInsertRowid, 'Ethan Park', 'Open budgets and smarter spending.', 2);

  const secretary = insPosition.run(electionId, 'Secretary', 2);
  insCandidate.run(secretary.lastInsertRowid, 'Maya Okafor', 'Clear communication and better record-keeping.', 0);
  insCandidate.run(secretary.lastInsertRowid, 'Lucas Moreau', 'Modernizing how the council shares updates.', 1);

  const proposalResult = db
    .prepare(
      `INSERT INTO elections (title, description, type, starts_at, ends_at, status, created_by)
       VALUES (?, ?, 'proposal', ?, ?, 'active', ?)`
    )
    .run(
      'Extend Library Weekend Hours',
      'Proposal to keep the central library open until midnight on weekends during exam season.',
      start,
      end,
      null
    );
  const proposalId = proposalResult.lastInsertRowid;
  const insOption = db.prepare('INSERT INTO options (election_id, text, sort_order) VALUES (?, ?, ?)');
  insOption.run(proposalId, 'Yes, extend hours', 0);
  insOption.run(proposalId, 'No, keep current hours', 1);
  insOption.run(proposalId, 'Abstain', 2);

  console.log(`[seed] created demo elections #${electionId} (candidate) and #${proposalId} (proposal)`);
}

migrate();
await upsertUser({
  studentId: ADMIN_STUDENT_ID,
  name: ADMIN_NAME,
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  role: 'admin',
  simulated: false,
});
await upsertUser({
  studentId: STUDENT_STUDENT_ID,
  name: STUDENT_NAME,
  email: STUDENT_EMAIL,
  password: STUDENT_PASSWORD,
  role: 'student',
  simulated: false,
});
demoElection();

console.log('[seed] done.');
db.close();
