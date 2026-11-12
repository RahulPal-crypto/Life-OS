import mysql from 'mysql2/promise';
import { env, buildDbConnectionConfig } from '../config/env.js';

const ensureTableColumns = async (connection, tableName, columns) => {
  for (const [colName, colDef] of columns) {
    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [env.db.database, tableName, colName]
    );
    if (cols.length === 0) {
      await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${colName}\` ${colDef}`);
      console.log(`[Migration] Added missing column '${tableName}.${colName}'.`);
    }
  }
};

export const runMigrations = async () => {
  console.log('[Migration] Starting LIFE OS Database Migration...');
  let connection;

  try {
    if (env.db.autoCreateDatabase) {
      try {
        connection = await mysql.createConnection(buildDbConnectionConfig({ includeDatabase: false }));
        console.log(`[Migration] Connected to MySQL Server at ${env.db.host}:${env.db.port}`);

        await connection.query(`
          CREATE DATABASE IF NOT EXISTS \`${env.db.database}\`
          CHARACTER SET utf8mb4
          COLLATE utf8mb4_unicode_ci;
        `);
        await connection.query(`USE \`${env.db.database}\``);
        console.log(`[Migration] Database '${env.db.database}' checked/selected.`);
      } catch (createErr) {
        // Fallback if managed SQL user lacks CREATE DATABASE privileges for a pre-created schema
        if (createErr.code === 'ER_DBACCESS_DENIED_ERROR' || createErr.code === 'ER_SPECIFIC_ACCESS_DENIED_ERROR') {
          if (connection) {
            await connection.end().catch(() => {});
            connection = null;
          }
          connection = await mysql.createConnection(buildDbConnectionConfig({ includeDatabase: true }));
          console.log(`[Migration] Connected directly to database '${env.db.database}'.`);
        } else {
          throw createErr;
        }
      }
    } else {
      connection = await mysql.createConnection(buildDbConnectionConfig({ includeDatabase: true }));
      console.log(`[Migration] Connected directly to database '${env.db.database}'.`);
    }

    // 3. Create 'users' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(191) NOT NULL UNIQUE,
        phone VARCHAR(30) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        profile_image VARCHAR(500) NULL,
        headline VARCHAR(100) NULL,
        bio VARCHAR(250) NULL,
        location VARCHAR(100) NULL,
        daily_focus_goal DECIMAL(4,1) DEFAULT 8.0,
        daily_steps_goal INT DEFAULT 8000,
        is_email_verified TINYINT(1) DEFAULT 0,
        is_phone_verified TINYINT(1) DEFAULT 0,
        account_status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        terms_accepted TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email),
        INDEX idx_users_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure profile extension columns exist on older database instances
    await ensureTableColumns(connection, 'users', [
      ['headline', 'VARCHAR(100) NULL'],
      ['bio', 'VARCHAR(250) NULL'],
      ['location', 'VARCHAR(100) NULL'],
      ['daily_focus_goal', 'DECIMAL(4,1) DEFAULT 8.0'],
      ['daily_steps_goal', 'INT DEFAULT 8000'],
    ]);
    console.log(`[Migration] Table 'users' verified.`);

    // 4. Create 'user_sessions' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        refresh_token_hash VARCHAR(64) NOT NULL,
        device_name VARCHAR(150) NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_revoked TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sessions_user_id (user_id),
        INDEX idx_sessions_token_hash (refresh_token_hash),
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'user_sessions' verified.`);

    // 5. Create 'email_verification_tokens' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        token VARCHAR(100) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_verify_token (token),
        CONSTRAINT fk_email_verify_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'email_verification_tokens' verified.`);

    // 6. Create 'password_reset_tokens' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        token VARCHAR(100) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_password_reset_token (token),
        CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'password_reset_tokens' verified.`);

    // 7. Create 'my_day_summaries' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS my_day_summaries (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        log_date DATE NOT NULL,
        study_hours DECIMAL(4,1) DEFAULT 0.0,
        work_hours DECIMAL(4,1) DEFAULT 0.0,
        active_steps INT DEFAULT 0,
        sleep_hours DECIMAL(4,1) DEFAULT 0.0,
        mood VARCHAR(50) DEFAULT 'Productive',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_my_day_user_date (user_id, log_date),
        INDEX idx_my_day_date (log_date),
        CONSTRAINT fk_my_day_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'my_day_summaries' verified.`);

    // 8. Create 'my_day_activities' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS my_day_activities (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        log_date DATE NOT NULL,
        time_string VARCHAR(20) NOT NULL,
        timestamp BIGINT NOT NULL,
        category ENUM('focus', 'meal', 'place', 'social', 'wake', 'sleep', 'note', 'workout', 'other') DEFAULT 'focus',
        title VARCHAR(150) NOT NULL,
        details TEXT NULL,
        meta VARCHAR(150) NULL,
        icon VARCHAR(10) DEFAULT '☑️',
        duration_minutes INT NULL,
        ends_at BIGINT NULL,
        timer_status ENUM('logged', 'active', 'completed') DEFAULT 'logged',
        is_auto_tracked TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_activities_user_date (user_id, log_date),
        INDEX idx_activities_timestamp (timestamp),
        CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await ensureTableColumns(connection, 'my_day_activities', [
      ['duration_minutes', 'INT NULL'],
      ['ends_at', 'BIGINT NULL'],
      ['timer_status', "ENUM('logged', 'active', 'completed') DEFAULT 'logged'"],
    ]);
    console.log(`[Migration] Table 'my_day_activities' verified.`);

    console.log('[Migration] All 6 tables migrated successfully.');
    return true;
  } catch (error) {
    console.error('[Migration Error]:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Execute if run directly from CLI
if (process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(() => {
      console.log('[Migration] Done. Exiting.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Failed]:', err);
      process.exit(1);
    });
}
