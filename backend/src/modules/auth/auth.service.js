import crypto from 'crypto';
import { query, withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { hashPassword, comparePassword, sha256, generateSecureToken } from '../../utils/hashHelper.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/tokenHelper.js';
import { normalizePhone } from './auth.validator.js';
import { ProfileService, formatUserProfile } from '../profile/profile.service.js';

const NORMALIZED_PHONE_SQL = "REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '')";

class AuthService {
  async findByNormalizedPhone(cleanPhone, excludeUserId = null, runQuery = query) {
    if (excludeUserId) {
      return runQuery(
        `SELECT id FROM users WHERE ${NORMALIZED_PHONE_SQL} = ? AND id <> ? LIMIT 1`,
        [cleanPhone, excludeUserId]
      );
    }
    return runQuery(
      `SELECT id FROM users WHERE ${NORMALIZED_PHONE_SQL} = ? LIMIT 1`,
      [cleanPhone]
    );
  }

  async register(payload, clientMeta = {}) {
    const { name, email, phone, password } = payload;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);

    // Check email existence
    const existingEmail = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
    if (existingEmail.length > 0) {
      const err = new Error('An account with this email address already exists.');
      err.statusCode = 409;
      err.code = 'EMAIL_ALREADY_EXISTS';
      throw err;
    }

    // Check phone existence using space/punctuation-insensitive matching
    const existingPhone = await this.findByNormalizedPhone(cleanPhone);
    let userId;
    const passwordHash = await hashPassword(password);

    if (existingPhone.length > 0) {
      if (existingPhone[0].email && existingPhone[0].email.endsWith('@lifeos.internal')) {
        // Upgrade contact placeholder to a real user account
        userId = existingPhone[0].id;
        await query(
          `UPDATE users
           SET name = ?, email = ?, password_hash = ?, terms_accepted = 1, updated_at = NOW()
           WHERE id = ?`,
          [name.trim(), cleanEmail, passwordHash, userId]
        );
      } else {
        const err = new Error('An account with this phone number already exists.');
        err.statusCode = 409;
        err.code = 'PHONE_ALREADY_EXISTS';
        throw err;
      }
    } else {
      userId = crypto.randomUUID();
      await query(
        `INSERT INTO users (id, name, email, phone, password_hash, is_email_verified, is_phone_verified, account_status, terms_accepted)
         VALUES (?, ?, ?, ?, ?, 0, 0, 'active', 1)`,
        [userId, name.trim(), cleanEmail, cleanPhone, passwordHash]
      );
    }

    const user = await ProfileService.getUserById(userId);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save session with hashed refresh token
    await this.createSession(userId, refreshToken, clientMeta);

    return {
      user,
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
      },
    };
  }

  async login(payload, clientMeta = {}) {
    const { identifier, password } = payload;
    const cleanEmail = identifier.trim().toLowerCase();
    const cleanPhone = normalizePhone(identifier);

    // Search by email or normalized phone
    const users = await query(
      `SELECT id, name, email, phone, password_hash, profile_image, headline, bio, location,
              daily_focus_goal, daily_steps_goal,
              is_email_verified, is_phone_verified, account_status, created_at, updated_at
       FROM users
       WHERE LOWER(email) = ? OR ${NORMALIZED_PHONE_SQL} = ?
       LIMIT 1`,
      [cleanEmail, cleanPhone]
    );

    if (users.length === 0) {
      const err = new Error('Invalid email/phone or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const userRecord = users[0];

    const isMatch = await comparePassword(password, userRecord.password_hash);
    if (!isMatch) {
      const err = new Error('Invalid email/phone or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    if (userRecord.account_status !== 'active') {
      const err = new Error(`Your account is currently ${userRecord.account_status}. Please contact support.`);
      err.statusCode = 403;
      err.code = 'ACCOUNT_NOT_ACTIVE';
      throw err;
    }

    const user = formatUserProfile(userRecord);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await this.createSession(user.id, refreshToken, clientMeta);

    return {
      user,
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
      },
    };
  }

  async refreshToken(rawRefreshToken, clientMeta = {}) {
    const decoded = verifyRefreshToken(rawRefreshToken);
    if (!decoded) {
      const err = new Error('Refresh token is invalid or has expired. Please sign in again.');
      err.statusCode = 401;
      err.code = 'INVALID_REFRESH_TOKEN';
      throw err;
    }

    const tokenHash = sha256(rawRefreshToken);

    const sessions = await query(
      `SELECT s.id, s.user_id, s.is_revoked, s.expires_at, u.name, u.email, u.phone, u.account_status
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.refresh_token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );

    if (sessions.length === 0) {
      const err = new Error('Session not found or has been revoked.');
      err.statusCode = 401;
      err.code = 'SESSION_NOT_FOUND';
      throw err;
    }

    const session = sessions[0];

    if (session.is_revoked || new Date(session.expires_at) < new Date()) {
      const err = new Error('Session has expired or has been revoked. Please sign in again.');
      err.statusCode = 401;
      err.code = 'SESSION_EXPIRED';
      throw err;
    }

    if (session.account_status !== 'active') {
      const err = new Error('User account is no longer active.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_NOT_ACTIVE';
      throw err;
    }

    const user = {
      id: session.user_id,
      name: session.name,
      email: session.email,
    };

    // Issue brand new token pair & rotate session atomically
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    await withTransaction(async (txQuery) => {
      const revokeRes = await txQuery(
        'UPDATE user_sessions SET is_revoked = 1 WHERE id = ? AND is_revoked = 0',
        [session.id]
      );
      if (revokeRes.affectedRows !== 1) {
        const err = new Error('Session has expired or has been revoked. Please sign in again.');
        err.statusCode = 401;
        err.code = 'SESSION_EXPIRED';
        throw err;
      }
      await this.createSession(user.id, newRefreshToken, clientMeta, txQuery);
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
    };
  }

  async logout(rawRefreshToken) {
    if (!rawRefreshToken) return;
    const tokenHash = sha256(rawRefreshToken);
    await query('UPDATE user_sessions SET is_revoked = 1 WHERE refresh_token_hash = ?', [tokenHash]);
  }

  async forgotPassword(identifier) {
    const cleanEmail = identifier.trim().toLowerCase();
    const cleanPhone = normalizePhone(identifier);

    const users = await query(
      `SELECT id, name, email FROM users
       WHERE LOWER(email) = ? OR ${NORMALIZED_PHONE_SQL} = ?
       LIMIT 1`,
      [cleanEmail, cleanPhone]
    );

    if (users.length === 0) {
      // Don't leak user existence in generic message, but return consistent response
      return {
        message: 'If an account exists with this credential, a password reset link has been dispatched.',
      };
    }

    const user = users[0];
    const resetToken = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    await query(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), user.id, resetToken, expiresAt]
    );

    return {
      message: `Password reset token generated and sent to ${user.email}.`,
      ...(env.nodeEnv !== 'production' ? { resetToken } : {}),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async resetPassword(token, newPassword) {
    const tokens = await query(
      `SELECT id, user_id, expires_at, is_used
       FROM password_reset_tokens
       WHERE token = ?
       LIMIT 1`,
      [token]
    );

    if (tokens.length === 0) {
      const err = new Error('Invalid or expired password reset token.');
      err.statusCode = 400;
      err.code = 'INVALID_RESET_TOKEN';
      throw err;
    }

    const tokenRecord = tokens[0];

    if (tokenRecord.is_used || new Date(tokenRecord.expires_at) < new Date()) {
      const err = new Error('This password reset link has already been used or has expired.');
      err.statusCode = 400;
      err.code = 'EXPIRED_RESET_TOKEN';
      throw err;
    }

    const newHash = await hashPassword(newPassword);

    await withTransaction(async (txQuery) => {
      const consumeRes = await txQuery(
        'UPDATE password_reset_tokens SET is_used = 1 WHERE id = ? AND is_used = 0',
        [tokenRecord.id]
      );
      if (consumeRes.affectedRows !== 1) {
        const err = new Error('This password reset link has already been used or has expired.');
        err.statusCode = 400;
        err.code = 'EXPIRED_RESET_TOKEN';
        throw err;
      }

      await txQuery('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, tokenRecord.user_id]);
      // Security: force re-login on all devices
      await txQuery('UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?', [tokenRecord.user_id]);
    });

    return {
      message: 'Password has been updated successfully. Please sign in with your new password.',
    };
  }

  async getProfile(userId) {
    return ProfileService.getUserById(userId);
  }

  async updateProfile(userId, updateData) {
    return ProfileService.updateProfile(userId, updateData);
  }

  async getSessions(userId) {
    const sessions = await query(
      `SELECT id, device_name, ip_address, is_revoked, created_at, last_active_at, expires_at
       FROM user_sessions
       WHERE user_id = ? AND is_revoked = 0 AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId]
    );

    return sessions.map(s => ({
      id: s.id,
      deviceName: s.device_name || 'Unknown Device',
      ipAddress: s.ip_address || 'Unknown IP',
      lastActiveAt: s.last_active_at,
      createdAt: s.created_at,
    }));
  }

  async revokeSession(userId, sessionId) {
    await query('UPDATE user_sessions SET is_revoked = 1 WHERE id = ? AND user_id = ?', [sessionId, userId]);
    return { message: 'Session revoked successfully.' };
  }

  async createSession(userId, rawRefreshToken, clientMeta, runQuery = query) {
    const sessionId = crypto.randomUUID();
    const tokenHash = sha256(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await runQuery(
      `INSERT INTO user_sessions (id, user_id, refresh_token_hash, device_name, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        userId,
        tokenHash,
        clientMeta.deviceName || 'Android Device',
        clientMeta.ipAddress || '127.0.0.1',
        clientMeta.userAgent || 'LifeOS-Mobile/1.0',
        expiresAt,
      ]
    );

    return sessionId;
  }
}

export const authService = new AuthService();
