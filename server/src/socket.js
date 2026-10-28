import { Server } from 'socket.io';
import { verifyAccessToken } from './utils/tokens.js';
import config from './config.js';
import { setIo } from './io.js';

export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.server.clientOrigin,
      credentials: true,
    },
    maxHttpBufferSize: 8 * 1024,
  });

  io.use((socket, next) => {
    const cookie = socket.handshake.headers.cookie || '';
    const match = /vf_at=([^;]+)/.exec(cookie);
    if (!match) return next(new Error('Unauthorized'));

    const token = decodeURIComponent(match[1]);
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = {
        id: Number(payload.sub),
        role: payload.role,
        studentId: payload.studentId,
      };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data?.user?.role === 'admin') {
      socket.join('admin:security');
    }
    socket.on('join:election', (electionId) => {
      const id = Number(electionId);
      if (Number.isInteger(id) && id > 0) socket.join(`election:${id}`);
    });
    socket.on('leave:election', (electionId) => {
      const id = Number(electionId);
      if (Number.isInteger(id) && id > 0) socket.leave(`election:${id}`);
    });
  });

  setIo(io);
  return io;
}
