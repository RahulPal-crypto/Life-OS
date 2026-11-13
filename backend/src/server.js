import app from './app.js';
import { env } from './config/env.js';
import { pool, testConnection } from './config/db.js';
import { runMigrations } from './database/migrate.js';
import { initConnectWebSocketServer } from './modules/connect/connect.socket.js';

const startServer = async () => {
  console.log('----------------------------------------------------');
  console.log('       ✦ LIFE OS - Modular Monolith Backend ✦       ');
  console.log('----------------------------------------------------');

  try {
    if (env.runMigrationsOnStartup) {
      await runMigrations();
    }

    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Unable to establish an active database connection pool.');
    }
  } catch (error) {
    console.error(`[Startup Error] Database initialization failed: ${error.message}`);
    console.error('[Startup Error] Verify TiDB/MySQL credentials, TLS settings, and .env configuration.');
    process.exit(1);
  }

  // Start Express HTTP Server
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[Server] LIFE OS Backend active on port ${env.port}`);
    console.log(`[Server] Environment: ${env.nodeEnv}`);
    console.log(`[Server] Local URL:   http://localhost:${env.port}`);
    console.log(`[Server] Health URL:  http://localhost:${env.port}/health`);
    console.log(`[Server] Auth API:    http://localhost:${env.port}${env.apiPrefix}/auth`);
    console.log('----------------------------------------------------');
  });

  // Attach My Connect Real-time WebSocket Server
  initConnectWebSocketServer(server);

  // Graceful Shutdown (close HTTP listener and MySQL/TiDB connection pool)
  let isShuttingDown = false;
  const handleShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Server] Received ${signal}. Gracefully terminating server...`);

    const forceExitTimer = setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    server.close(async () => {
      try {
        await pool.end();
        console.log('[Server] HTTP connections and database pool closed. Process terminating.');
        clearTimeout(forceExitTimer);
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error closing database pool:', err.message);
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
};

startServer();
