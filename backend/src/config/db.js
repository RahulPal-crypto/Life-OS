import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  dateStrings: ['DATE'],
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

export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] MySQL connected successfully to '${env.db.database}' at ${env.db.host}:${env.db.port}`);
    connection.release();
    return true;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MySQL:`, error.message);
    return false;
  }
};
