import { Router } from 'express';
import { z } from 'zod';
import { db, toIso } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getSecurityDashboardMetrics,
  analyzeSecurityTelemetry,
  chatWithSecurityCopilot,
  executeDefensiveAction,
  simulateSecurityAttack,
  generateSecurityReport,
  copilotConfig,
} from '../securityCopilotService.js';

const router = Router();

// Protect all security routes for Admin only
router.use(requireAuth, requireAdmin);

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Message is required.').max(2000),
  history: z.array(z.any()).optional(),
});

const mitigateSchema = z.object({
  actionType: z.enum(['block_ip', 'unblock_ip', 'revoke_user_sessions', 'pause_election', 'resume_election', 'clear_events']),
  target: z.string().optional(),
  reason: z.string().optional(),
});

const simulateSchema = z.object({
  attackType: z.enum(['credential_stuffing', 'token_hijack', 'sybil_voting_anomaly', 'admin_escalation']),
});

const configSchema = z.object({
  provider: z.enum(['builtin', 'openai', 'gemini', 'ollama', 'custom']),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

// GET /api/admin/security/dashboard
router.get('/dashboard', (req, res) => {
  const metrics = getSecurityDashboardMetrics();
  return res.json(metrics);
});

// GET /api/admin/security/events
router.get('/events', (req, res) => {
  const { severity, type, search, limit = 50 } = req.query;
  let sql = `
    SELECT e.*, u.student_id, u.name 
    FROM security_events e 
    LEFT JOIN users u ON e.user_id = u.id 
    WHERE 1=1
  `;
  const params = [];

  if (severity) {
    sql += ` AND e.severity = ?`;
    params.push(severity);
  }
  if (type) {
    sql += ` AND e.event_type LIKE ?`;
    params.push(`%${type}%`);
  }
  if (search) {
    sql += ` AND (e.ip LIKE ? OR e.event_type LIKE ? OR u.student_id LIKE ? OR e.details LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY e.created_at DESC LIMIT ?`;
  params.push(Number(limit) || 50);

  const rows = db.prepare(sql).all(...params).map(e => ({
    id: e.id,
    userId: e.user_id,
    studentId: e.student_id,
    name: e.name,
    eventType: e.event_type,
    severity: e.severity,
    ip: e.ip,
    details: e.details ? JSON.parse(e.details) : null,
    resolved: !!e.resolved,
    createdAt: toIso(e.created_at),
  }));

  return res.json({ events: rows });
});

// POST /api/admin/security/analyze
router.post('/analyze', async (req, res) => {
  try {
    const analysis = await analyzeSecurityTelemetry(req.body);
    return res.json(analysis);
  } catch (err) {
    return res.status(500).json({ error: `Analysis failed: ${err.message}` });
  }
});

// POST /api/admin/security/chat
router.post('/chat', validate(chatSchema), async (req, res) => {
  try {
    const result = await chatWithSecurityCopilot({
      message: req.body.message,
      history: req.body.history,
      userId: req.user.id,
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: `Copilot chat error: ${err.message}` });
  }
});

// POST /api/admin/security/mitigate
router.post('/mitigate', validate(mitigateSchema), (req, res) => {
  try {
    const result = executeDefensiveAction({
      actionType: req.body.actionType,
      target: req.body.target,
      reason: req.body.reason,
      userId: req.user.id,
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/security/simulate-attack
router.post('/simulate-attack', validate(simulateSchema), (req, res) => {
  try {
    const result = simulateSecurityAttack(req.body.attackType, req.user.id);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/security/report
router.get('/report', (req, res) => {
  const markdown = generateSecurityReport();
  return res.json({ report: markdown });
});

// POST /api/admin/security/config
router.post('/config', validate(configSchema), (req, res) => {
  if (req.body.provider) copilotConfig.provider = req.body.provider;
  if (req.body.apiKey !== undefined) copilotConfig.apiKey = req.body.apiKey;
  if (req.body.model) copilotConfig.model = req.body.model;

  return res.json({
    message: 'Security Copilot configuration updated.',
    config: {
      provider: copilotConfig.provider,
      model: copilotConfig.model,
      hasApiKey: !!copilotConfig.apiKey,
    },
  });
});

export default router;
