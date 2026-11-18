import { buildApp } from './app.js';
import { getDatabase, closeDatabase } from './db/connection.js';
import { config } from './config/env.js';

async function startServer() {
  // 1. Initialize and verify database connection
  try {
    const db = getDatabase();
    // Warm up DB with a simple probe
    db.prepare('SELECT 1').get();
  } catch (err) {
    console.error('Fatal: Failed to initialize local database:', err);
    process.exit(1);
  }

  // 2. Build Fastify application
  const app = buildApp();

  // 3. Graceful shutdown handler
  const shutdown = async (signal) => {
    try {
      await app.close();
      closeDatabase();
    } catch {
      // Force exit
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 4. Start listening on 0.0.0.0:8080
  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });
    console.log(`[Last Server Standing] Production server listening on ${config.host}:${config.port}`);
  } catch (err) {
    console.error('Fatal: Failed to start HTTP server:', err);
    closeDatabase();
    process.exit(1);
  }
}

startServer();
