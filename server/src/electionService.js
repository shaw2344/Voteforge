import { db, toIso } from './db.js';

export function effectiveStatus(election) {
  if (election.status === 'closed') return 'closed';
  const now = Date.now();
  const start = new Date(toIso(election.starts_at)).getTime();
  const end = new Date(toIso(election.ends_at)).getTime();
  if (now < start) return 'upcoming';
  if (now > end) return 'closed';
  return election.status === 'draft' ? 'draft' : 'active';
}

export function summary(election) {
  const status = effectiveStatus(election);
  const voterCount =
    db
      .prepare(
        'SELECT COUNT(DISTINCT voter_id) AS c FROM votes WHERE election_id = ?'
      )
      .get(election.id).c ?? 0;

  return {
    id: election.id,
    title: election.title,
    description: election.description,
    type: election.type,
    startsAt: toIso(election.starts_at),
    endsAt: toIso(election.ends_at),
    status,
    storedStatus: election.status,
    voterCount,
    createdAt: toIso(election.created_at),
  };
}

export function getElection(id) {
  return db.prepare('SELECT * FROM elections WHERE id = ?').get(id);
}

export function getDetail(id) {
  const election = getElection(id);
  if (!election) return null;

  const detail = { ...summary(election) };

  if (election.type === 'candidate') {
    const positions = db
      .prepare('SELECT * FROM positions WHERE election_id = ? ORDER BY sort_order, id')
      .all(id);
    detail.positions = positions.map((p) => {
      const candidates = db
        .prepare(
          `SELECT c.*,
                  (SELECT COUNT(*) FROM votes v WHERE v.position_id = c.position_id AND v.candidate_id = c.id) AS votes
           FROM candidates c WHERE c.position_id = ? ORDER BY c.sort_order, c.id`
        )
        .all(p.id);
      return {
        id: p.id,
        title: p.title,
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          bio: c.bio,
          votes: c.votes,
        })),
      };
    });
  } else {
    const options = db
      .prepare(
        `SELECT o.*,
                (SELECT COUNT(*) FROM votes v WHERE v.option_id = o.id) AS votes
         FROM options o WHERE o.election_id = ? ORDER BY o.sort_order, o.id`
      )
      .all(id);
    detail.options = options.map((o) => ({
      id: o.id,
      text: o.text,
      votes: o.votes,
    }));
  }

  return detail;
}

export function computeResults(election) {
  const type = election.type;
  const registeredVoters =
    db.prepare('SELECT COUNT(*) AS c FROM users').get().c ?? 0;
  const voterCount =
    db
      .prepare('SELECT COUNT(DISTINCT voter_id) AS c FROM votes WHERE election_id = ?')
      .get(election.id).c ?? 0;

  const results = { electionId: election.id, type, status: effectiveStatus(election) };

  if (type === 'candidate') {
    const positions = db
      .prepare('SELECT * FROM positions WHERE election_id = ? ORDER BY sort_order, id')
      .all(election.id);
    results.positions = positions.map((p) => {
      const total = db
        .prepare('SELECT COUNT(*) AS c FROM votes WHERE position_id = ?')
        .get(p.id).c;
      const candidates = db
        .prepare('SELECT * FROM candidates WHERE position_id = ? ORDER BY sort_order, id')
        .all(p.id)
        .map((c) => {
          const votes = db
            .prepare('SELECT COUNT(*) AS c FROM votes WHERE position_id = ? AND candidate_id = ?')
            .get(p.id, c.id).c;
          return {
            id: c.id,
            name: c.name,
            votes,
            pct: total > 0 ? Math.round((votes / total) * 1000) / 10 : 0,
            winner: total > 0 && votes === total,
          };
        });
      return { id: p.id, title: p.title, total, candidates };
    });
  } else {
    const total = voterCount;
    const options = db
      .prepare('SELECT * FROM options WHERE election_id = ? ORDER BY sort_order, id')
      .all(election.id)
      .map((o) => {
        const votes = db
          .prepare('SELECT COUNT(*) AS c FROM votes WHERE option_id = ?')
          .get(o.id).c;
        return {
          id: o.id,
          text: o.text,
          votes,
          pct: total > 0 ? Math.round((votes / total) * 1000) / 10 : 0,
        };
      });
    results.options = options;
    results.total = total;
  }

  results.voterCount = voterCount;
  results.registeredVoters = registeredVoters;
  results.turnout = registeredVoters > 0 ? Math.round((voterCount / registeredVoters) * 1000) / 10 : 0;
  return results;
}

export function computeOverview() {
  const elections = db
    .prepare('SELECT * FROM elections ORDER BY starts_at DESC, id DESC')
    .all();
  const registeredVoters = db.prepare('SELECT COUNT(*) AS c FROM users').get().c ?? 0;

  return elections.map((e) => {
    const voterCount =
      db
        .prepare('SELECT COUNT(DISTINCT voter_id) AS c FROM votes WHERE election_id = ?')
        .get(e.id).c ?? 0;

    let lead = null;
    if (e.type === 'candidate') {
      const best = db
        .prepare(
          `SELECT c.name AS name, p.title AS position, COUNT(v.id) AS votes
           FROM candidates c
           JOIN positions p ON p.id = c.position_id
           LEFT JOIN votes v ON v.candidate_id = c.id AND v.position_id = c.position_id
           WHERE p.election_id = ?
           GROUP BY c.id
           ORDER BY votes DESC
           LIMIT 1`
        )
        .get(e.id);
      if (best && best.votes > 0) {
        lead = { name: best.name, position: best.position, votes: best.votes };
      }
    } else {
      const best = db
        .prepare(
          `SELECT o.text AS name, COUNT(v.id) AS votes
           FROM options o
           LEFT JOIN votes v ON v.option_id = o.id
           WHERE o.election_id = ?
           GROUP BY o.id
           ORDER BY votes DESC
           LIMIT 1`
        )
        .get(e.id);
      if (best && best.votes > 0) {
        lead = { name: best.name, position: null, votes: best.votes };
      }
    }

    return {
      id: e.id,
      title: e.title,
      type: e.type,
      status: effectiveStatus(e),
      voterCount,
      registeredVoters,
      turnout: registeredVoters > 0 ? Math.round((voterCount / registeredVoters) * 1000) / 10 : 0,
      lead,
    };
  });
}
