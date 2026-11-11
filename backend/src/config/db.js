import mysql from 'mysql2/promise';
import { env, buildDbConnectionConfig } from './env.js';

export const pool = mysql.createPool({
  ...buildDbConnectionConfig({ includeDatabase: true }),
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export const query = async (sql, params = []) => {
  const [results] = await pool.execute(sql, params);
  return results;
};

/**
 * Execute multiple SQL operations inside an atomic transaction.
 */
export const withTransaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const txQuery = async (sql, params = []) => {
      const [results] = await connection.execute(sql, params);
      return results;
    };
    const result = await callback(txQuery, connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const pingDatabase = async () => {
  await pool.query('SELECT 1');
};

export const testConnection = async () => {
  try {
    await pingDatabase();
    const tlsLabel = env.db.ssl ? ' (TLS)' : '';
    console.log(`[Database] MySQL connected successfully to '${env.db.database}' at ${env.db.host}:${env.db.port}${tlsLabel}`);
    return true;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MySQL:`, error.message);
    return false;
  }
};
