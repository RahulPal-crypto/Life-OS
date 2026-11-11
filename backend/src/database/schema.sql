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
