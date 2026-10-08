import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import receiptRoutes from './routes/receiptRoutes.js';
import classRoutes from './routes/classRoutes.js';
import nicknameRoutes from './routes/nicknameRoutes.js';
import { registerSocketHandlers } from './sockets/socketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createExpressApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false // Allows client bundling in production and socket.io scripts
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching CLIENT_URL
        if (!origin || origin === env.CLIENT_URL || env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS'));
        }
      },
      credentials: true
    })
  );

  app.use(express.json({ limit: '200kb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({ ok: true, aiMock: env.AI_MOCK });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/receipts', receiptRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/nicknames', nicknameRoutes);

  return app;
}

export function startServer(port = env.PORT) {
  const app = createExpressApp();
  const server = http.createServer(app);

  // Initialize Socket.io server
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || origin === env.CLIENT_URL || env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS'));
        }
      },
      credentials: true
    },
    maxHttpBufferSize: 10 * 1024, // 10 KB max payload
    transports: ['websocket', 'polling']
  });

  const sweeperInterval = registerSocketHandlers(io);

  // Serve static files in production if client/dist exists, or provide root status for API-only deployments
  if (env.NODE_ENV === 'production') {
    const clientDistPath = path.resolve(__dirname, '../../client/dist');
    const indexHtmlPath = path.join(clientDistPath, 'index.html');

    if (fs.existsSync(indexHtmlPath)) {
      app.use(express.static(clientDistPath));
      app.get('*', (req, res, next) => {
        if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/socket.io')) {
          return next();
        }
        res.sendFile(indexHtmlPath);
      });
    } else {
      // Backend-only deployment (Render backend with separate frontend on Vercel)
      app.get('/favicon.ico', (req, res) => res.status(204).end());
      app.get('/', (req, res) => {
        res.status(200).json({
          status: 'ok',
          service: 'ReviseLive API & WebSocket Server',
          environment: 'production',
          health: '/api/health'
        });
      });
    }
  }

  // Not found & error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return new Promise(async (resolve, reject) => {
    try {
      if (env.NODE_ENV !== 'test') {
        await connectDB();
      }

      const shutdown = async (signal) => {
        logger.info(`Received ${signal}. Shutting down gracefully...`);
        clearInterval(sweeperInterval);
        io.emit('room:closed', { reason: 'Server shutting down' });
        server.close(async () => {
          await disconnectDB();
          logger.info('Server closed.');
          process.exit(0);
        });
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

      server.listen(port, () => {
        logger.info(`🚀 ReviseLive server listening on port ${port} (${env.NODE_ENV})`);
        if (env.AI_MOCK && env.NODE_ENV === 'production') {
          logger.warn('⚠️ WARNING: AI_MOCK mode is active in PRODUCTION! Quizzes will be generated using mock templates.');
        }
        resolve({ server, app, io });
      });
    } catch (err) {
      logger.error(`Failed to start server: ${err.message}`);
      reject(err);
    }
  });
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
