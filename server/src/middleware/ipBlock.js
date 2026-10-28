import { isIpBlocked } from '../db.js';

export function checkIpBlock(req, res, next) {
  const clientIp = req.ip || req.socket.remoteAddress;
  if (isIpBlocked(clientIp)) {
    return res.status(403).json({
      error: 'Access denied: Your IP address has been blocked by VoteForge AI Security Copilot due to suspicious activity.',
      code: 'IP_BLOCKED',
    });
  }
  next();
}
