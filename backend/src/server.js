import app from './app.js';
import { env } from './config/env.js';
import { testConnection } from './config/db.js';
import { runMigrations } from './database/migrate.js';

const startServer = async () => {
  console.log('----------------------------------------------------');
  console.log('       ✦ LIFE OS - Modular Monolith Backend ✦       ');
  console.log('----------------------------------------------------');

  try {
    // 1. Run migrations if DB is accessible
    await runMigrations();

    // 2. Test active DB connection pool
    await testConnection();
  } catch (error) {
    console.warn(`[Warning] Database auto-migration skipped or failed: ${error.message}`);
    console.warn(`[Warning] Please verify MySQL service is running and credentials in .env are correct.`);
  }

  // 3. Start Express HTTP Server
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[Server] LIFE OS Backend active on port ${env.port}`);
    console.log(`[Server] Local URL:   http://localhost:${env.port}`);
    console.log(`[Server] Health URL:  http://localhost:${env.port}/health`);
    console.log(`[Server] Auth API:    http://localhost:${env.port}${env.apiPrefix}/auth`);
    console.log('----------------------------------------------------');
  });

  // Graceful Shutdown
  const handleShutdown = (signal) => {
    console.log(`\n[Server] Received ${signal}. Gracefully terminating server...`);
    server.close(() => {
      console.log('[Server] HTTP connections closed. Process terminating.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
};

startServer();
