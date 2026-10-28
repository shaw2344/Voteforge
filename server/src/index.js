import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config.js';
import { migrate } from './db.js';
import { attachSocket } from './socket.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { checkIpBlock } from './middleware/ipBlock.js';
import { errorHandler, notFound } from './middleware/validate.js';

import authRoutes from './routes/auth.js';
import electionRoutes from './routes/elections.js';
import voteRoutes from './routes/votes.js';
import myVotesRoutes from './routes/myVotes.js';
import adminRoutes from './routes/admin.js';
import securityRoutes from './routes/security.js';

migrate();

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: config.isProduction
      ? undefined
      : { directives: { defaultSrc: ["'self'"], connectSrc: ["'self'", 'http://localhost:5173'] } },
  })
);

if (config.isProduction) {
  const allowed = config.security.corsAllowedOrigins.length
    ? config.security.corsAllowedOrigins
    : [config.server.clientOrigin];
  app.use(
    cors({ origin: allowed, credentials: true })
  );
} else {
  app.use(cors({ origin: config.server.clientOrigin, credentials: true }));
}

app.use(cookieParser());
app.use(express.json({ limit: config.security.maxBodySize }));
app.use(checkIpBlock);
app.use(globalLimiter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/elections', voteRoutes);
app.use('/api/votes', myVotesRoutes);
app.use('/api/admin/security', securityRoutes);
app.use('/api/admin', adminRoutes);

const clientDist = config.server.clientDist;
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use('/api', notFound);
app.use(errorHandler);

const server = http.createServer(app);
attachSocket(server);

server.listen(config.server.port, () => {
  console.log(`[voteforge] server listening on http://localhost:${config.server.port}`);
  console.log(`[voteforge] environment: ${config.nodeEnv}`);
  if (!config.isProduction) {
    console.log(`[voteforge] client origin: ${config.server.clientOrigin}`);
  }
});

function shutdown() {
  console.log('[voteforge] shutting down...');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

