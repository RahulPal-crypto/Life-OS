-- LIFE OS Database Schema (MySQL 8.0)
-- Modular Monolith Authentication Schema

CREATE DATABASE IF NOT EXISTS life_os
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE life_os;

-- 1. USERS TABLE
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

-- 2. USER SESSIONS TABLE (Multi-device refresh tokens)
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

-- 3. EMAIL VERIFICATION TOKENS TABLE
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

-- 4. PASSWORD RESET TOKENS TABLE
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

-- 5. MY DAY SUMMARIES TABLE (Daily Metrics & Overview)
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

-- 6. MY DAY ACTIVITIES TABLE (Chronological Timeline Events)
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
  is_auto_tracked TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_activities_user_date (user_id, log_date),
  INDEX idx_activities_timestamp (timestamp),
  CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. MEMORY FOLDERS TABLE
CREATE TABLE IF NOT EXISTS memory_folders (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  parent_id VARCHAR(36) NULL,
  name VARCHAR(120) NOT NULL,
  color VARCHAR(30) DEFAULT '#7C3AED',
  icon VARCHAR(20) DEFAULT '📁',
  is_pinned TINYINT(1) DEFAULT 0,
  is_vault TINYINT(1) DEFAULT 0,
  is_trashed TINYINT(1) DEFAULT 0,
  trashed_at BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_memory_folders_user (user_id, is_vault, is_trashed),
  CONSTRAINT fk_memory_folders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. MEMORY ITEMS TABLE
CREATE TABLE IF NOT EXISTS memory_items (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  folder_id VARCHAR(36) NULL,
  title VARCHAR(180) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  media_type ENUM('photo', 'video', 'document', 'audio', 'other') DEFAULT 'other',
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
  CONSTRAINT fk_memory_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. MEMORY VAULT SETTINGS TABLE
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

-- 10. CONNECT SECURITY SETTINGS TABLE (App lock / PIN / Biometric for My Connect)
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

-- 11. CONNECT CONVERSATIONS TABLE (Direct 1-on-1 and Group chats)
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

-- 12. CONNECT CONVERSATION MEMBERS TABLE
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

-- 13. CONNECT MESSAGES TABLE (Text, Media, Documents, Voice Notes, System)
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

-- 14. CONNECT CONTACTS TABLE (Phone Contacts synced & custom contacts)
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
