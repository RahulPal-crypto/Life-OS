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

    // 9. Create 'memory_folders' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS memory_folders (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        parent_id VARCHAR(36) NULL,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20) DEFAULT '#7C3AED',
        icon VARCHAR(16) DEFAULT '📁',
        is_pinned TINYINT(1) DEFAULT 0,
        is_vault TINYINT(1) DEFAULT 0,
        is_trashed TINYINT(1) DEFAULT 0,
        trashed_at BIGINT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_memory_folders_user (user_id, is_vault, is_trashed, parent_id),
        CONSTRAINT fk_memory_folders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'memory_folders' verified.`);

    // 10. Create 'memory_items' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS memory_items (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        folder_id VARCHAR(36) NULL,
        title VARCHAR(180) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        media_type ENUM('photo', 'video', 'document', 'audio', 'other') NOT NULL DEFAULT 'document',
        mime_type VARCHAR(120) NULL,
        size_bytes BIGINT DEFAULT 0,
        local_uri TEXT NULL,
        vault_uri TEXT NULL,
        drive_file_id VARCHAR(180) NULL,
        drive_synced TINYINT(1) DEFAULT 0,
        story TEXT NULL,
        memory_date DATE NOT NULL,
        location VARCHAR(150) NULL,
        people VARCHAR(255) NULL,
        tags VARCHAR(255) NULL,
        mood VARCHAR(40) NULL,
        is_favorite TINYINT(1) DEFAULT 0,
        is_vault TINYINT(1) DEFAULT 0,
        is_trashed TINYINT(1) DEFAULT 0,
        trashed_at BIGINT NULL,
        linked_activity_id VARCHAR(36) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_memory_items_user_folder (user_id, is_vault, is_trashed, folder_id),
        INDEX idx_memory_items_user_date (user_id, memory_date),
        INDEX idx_memory_items_user_type (user_id, media_type),
        CONSTRAINT fk_memory_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_memory_items_folder FOREIGN KEY (folder_id) REFERENCES memory_folders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'memory_items' verified.`);

    // 11. Create 'memory_vault_settings' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS memory_vault_settings (
        user_id VARCHAR(36) PRIMARY KEY,
        pin_hash VARCHAR(255) NULL,
        biometric_key_hash VARCHAR(255) NULL,
        biometric_enabled TINYINT(1) DEFAULT 1,
        failed_attempts INT DEFAULT 0,
        locked_until BIGINT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_memory_vault_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await ensureTableColumns(connection, 'memory_vault_settings', [
      ['biometric_key_hash', 'VARCHAR(255) NULL'],
    ]);
    console.log(`[Migration] Table 'memory_vault_settings' verified.`);

    // 12. Create 'connect_security_settings' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS connect_security_settings (
        user_id VARCHAR(36) PRIMARY KEY,
        pin_hash VARCHAR(255) NULL,
        biometric_key_hash VARCHAR(255) NULL,
        biometric_enabled TINYINT(1) DEFAULT 1,
        failed_attempts INT DEFAULT 0,
        locked_until BIGINT NULL,
        auto_lock_delay VARCHAR(20) DEFAULT 'immediate',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_connect_security_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'connect_security_settings' verified.`);

    // 13. Create 'connect_conversations' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS connect_conversations (
        id VARCHAR(36) PRIMARY KEY,
        type ENUM('direct', 'group') NOT NULL DEFAULT 'direct',
        name VARCHAR(120) NULL,
        icon VARCHAR(500) NULL,
        description VARCHAR(255) NULL,
        created_by VARCHAR(36) NOT NULL,
        last_message_text TEXT NULL,
        last_message_sender_id VARCHAR(36) NULL,
        last_message_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_connect_conv_last_msg (last_message_at),
        CONSTRAINT fk_connect_conv_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'connect_conversations' verified.`);

    // 14. Create 'connect_conversation_members' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS connect_conversation_members (
        id VARCHAR(36) PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        role ENUM('admin', 'member') DEFAULT 'member',
        nickname VARCHAR(100) NULL,
        is_muted TINYINT(1) DEFAULT 0,
        is_pinned TINYINT(1) DEFAULT 0,
        is_favorite TINYINT(1) DEFAULT 0,
        last_read_message_id VARCHAR(36) NULL,
        last_read_at TIMESTAMP NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_conv_member (conversation_id, user_id),
        INDEX idx_conv_member_user (user_id),
        CONSTRAINT fk_conv_members_conv FOREIGN KEY (conversation_id) REFERENCES connect_conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_conv_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'connect_conversation_members' verified.`);

    // 15. Create or Alter 'connect_messages' table (supports text, image, video, document, audio, system)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS connect_messages (
        id VARCHAR(36) PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL,
        sender_id VARCHAR(36) NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text',
        content TEXT NOT NULL,
        media_url TEXT NULL,
        file_name VARCHAR(255) NULL,
        file_size BIGINT NULL,
        mime_type VARCHAR(100) NULL,
        media_duration INT NULL,
        thumbnail_url TEXT NULL,
        status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
        reply_to_id VARCHAR(36) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_connect_msg_conv_time (conversation_id, created_at),
        INDEX idx_connect_msg_sender (sender_id),
        CONSTRAINT fk_connect_msg_conv FOREIGN KEY (conversation_id) REFERENCES connect_conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_connect_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure Phase 2 columns exist on previously created tables
    try {
      const [mediaUrlCol] = await connection.query(`SHOW COLUMNS FROM connect_messages LIKE 'media_url'`);
      if (mediaUrlCol.length === 0) {
        await connection.query(`
          ALTER TABLE connect_messages
            MODIFY COLUMN message_type VARCHAR(20) DEFAULT 'text',
            ADD COLUMN media_url TEXT NULL AFTER content,
            ADD COLUMN file_name VARCHAR(255) NULL AFTER media_url,
            ADD COLUMN file_size BIGINT NULL AFTER file_name,
            ADD COLUMN mime_type VARCHAR(100) NULL AFTER file_size,
            ADD COLUMN media_duration INT NULL AFTER mime_type,
            ADD COLUMN thumbnail_url TEXT NULL AFTER media_duration
        `);
        console.log(`[Migration] Added Phase 2 media columns to 'connect_messages'.`);
      }
    } catch (colErr) {
      console.warn(`[Migration] Note on connect_messages schema update:`, colErr.message);
    }
    console.log(`[Migration] Table 'connect_messages' verified.`);

    // 16. Create 'connect_contacts' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS connect_contacts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        contact_user_id VARCHAR(36) NOT NULL,
        custom_name VARCHAR(100) NULL,
        phone_number VARCHAR(30) NULL,
        is_blocked TINYINT(1) DEFAULT 0,
        is_favorite TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_contact (user_id, contact_user_id),
        INDEX idx_connect_contacts_user (user_id),
        CONSTRAINT fk_connect_contacts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_connect_contacts_target FOREIGN KEY (contact_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'connect_contacts' verified.`);

    // 17. Create 'connect_calls' table (Voice & Video Calls Phase 3)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS connect_calls (
        id VARCHAR(36) PRIMARY KEY,
        caller_id VARCHAR(36) NOT NULL,
        receiver_id VARCHAR(36) NOT NULL,
        conversation_id VARCHAR(36) NULL,
        call_type ENUM('voice', 'video') NOT NULL DEFAULT 'voice',
        status ENUM('ringing', 'ongoing', 'completed', 'missed', 'declined', 'busy') NOT NULL DEFAULT 'ringing',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        duration_seconds INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_connect_calls_users (caller_id, receiver_id),
        INDEX idx_connect_calls_conv (conversation_id),
        CONSTRAINT fk_call_caller FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_call_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log(`[Migration] Table 'connect_calls' verified.`);

    console.log('[Migration] All Connect tables verified successfully.');
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
