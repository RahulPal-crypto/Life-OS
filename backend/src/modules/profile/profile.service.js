import { query, withTransaction } from '../../config/db.js';
import { comparePassword, hashPassword, sha256 } from '../../utils/hashHelper.js';
import { normalizePhone } from '../auth/auth.validator.js';

const NORMALIZED_PHONE_SQL = "REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '')";

const USER_PROFILE_COLUMNS = `
  id, name, email, phone, profile_image, headline, bio, location,
  daily_focus_goal, daily_steps_goal,
  is_email_verified, is_phone_verified, account_status, created_at, updated_at
`;

export const formatUserProfile = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  profileImage: u.profile_image || null,
  headline: u.headline || null,
  bio: u.bio || null,
  location: u.location || null,
  dailyFocusGoal: u.daily_focus_goal !== undefined && u.daily_focus_goal !== null ? Number(u.daily_focus_goal) : 8.0,
  dailyStepsGoal: u.daily_steps_goal !== undefined && u.daily_steps_goal !== null ? Number(u.daily_steps_goal) : 8000,
  isEmailVerified: Boolean(u.is_email_verified),
  isPhoneVerified: Boolean(u.is_phone_verified),
  accountStatus: u.account_status,
  createdAt: u.created_at,
  updatedAt: u.updated_at,
});

export class ProfileService {
  static async getUserById(userId) {
    const users = await query(
      `SELECT ${USER_PROFILE_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (users.length === 0) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    return formatUserProfile(users[0]);
  }

  /**
   * Fetch user profile details together with live aggregated life stats and active sessions.
   */
  static async getOverview(userId) {
    const [user, summaryStatsRows, activityStatsRows, sessions] = await Promise.all([
      this.getUserById(userId),
      query(
        `SELECT
           COUNT(*) AS days_tracked,
           COALESCE(SUM(study_hours), 0) AS total_study_hours,
           COALESCE(SUM(work_hours), 0) AS total_work_hours,
           COALESCE(ROUND(AVG(NULLIF(sleep_hours, 0)), 1), 0) AS avg_sleep_hours
         FROM my_day_summaries
         WHERE user_id = ?`,
        [userId]
      ),
      query(
        `SELECT
           COUNT(*) AS total_activities,
           COUNT(DISTINCT log_date) AS active_days
         FROM my_day_activities
         WHERE user_id = ?`,
        [userId]
      ),
      query(
        `SELECT id, device_name, ip_address, created_at, last_active_at
         FROM user_sessions
         WHERE user_id = ? AND is_revoked = 0 AND expires_at > NOW()
         ORDER BY last_active_at DESC`,
        [userId]
      ),
    ]);

    const sStats = summaryStatsRows[0] || {};
    const aStats = activityStatsRows[0] || {};

    return {
      user,
      stats: {
        daysTracked: Math.max(Number(sStats.days_tracked) || 0, Number(aStats.active_days) || 0),
        totalActivities: Number(aStats.total_activities) || 0,
        totalStudyHours: Math.round((Number(sStats.total_study_hours) || 0) * 10) / 10,
        totalWorkHours: Math.round((Number(sStats.total_work_hours) || 0) * 10) / 10,
        avgSleepHours: Number(sStats.avg_sleep_hours) || 0,
        activeSessionsCount: sessions.length,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceName: s.device_name || 'Unknown Device',
        ipAddress: s.ip_address || 'Unknown IP',
        lastActiveAt: s.last_active_at,
        createdAt: s.created_at,
      })),
    };
  }

  /**
   * Update user profile fields safely with duplicate phone checking.
   */
  static async updateProfile(userId, updateData) {
    const fieldColumnMap = [
      ['name', 'name'],
      ['profileImage', 'profile_image'],
      ['headline', 'headline'],
      ['bio', 'bio'],
      ['location', 'location'],
      ['dailyFocusGoal', 'daily_focus_goal'],
      ['dailyStepsGoal', 'daily_steps_goal'],
    ];

    const fields = [];
    const params = [];

    for (const [key, column] of fieldColumnMap) {
      if (updateData[key] !== undefined) {
        fields.push(`${column} = ?`);
        params.push(typeof updateData[key] === 'string' ? updateData[key].trim() : updateData[key]);
      }
    }

    if (updateData.phone !== undefined && typeof updateData.phone === 'string') {
      const cleanPhone = normalizePhone(updateData.phone);
      const existingPhone = await query(
        `SELECT id FROM users WHERE ${NORMALIZED_PHONE_SQL} = ? AND id <> ? LIMIT 1`,
        [cleanPhone, userId]
      );
      if (existingPhone.length > 0) {
        const err = new Error('An account with this phone number already exists.');
        err.statusCode = 409;
        err.code = 'PHONE_ALREADY_EXISTS';
        throw err;
      }
      fields.push('phone = ?');
      params.push(cleanPhone);
    }

    if (fields.length === 0) {
      return this.getUserById(userId);
    }

    params.push(userId);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);

    return this.getUserById(userId);
  }

  /**
   * Verify current password, update password hash, and optionally revoke other sessions.
   */
  static async changePassword(userId, { currentPassword, newPassword, currentRefreshToken }) {
    const users = await query(
      'SELECT id, password_hash FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (users.length === 0) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const isMatch = await comparePassword(currentPassword, users[0].password_hash);
    if (!isMatch) {
      const err = new Error('Current password is incorrect.');
      err.statusCode = 401;
      err.code = 'INVALID_CURRENT_PASSWORD';
      throw err;
    }

    const newHash = await hashPassword(newPassword);

    await withTransaction(async (txQuery) => {
      await txQuery('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

      if (currentRefreshToken && typeof currentRefreshToken === 'string') {
        const currentHash = sha256(currentRefreshToken);
        await txQuery(
          'UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ? AND refresh_token_hash <> ? AND is_revoked = 0',
          [userId, currentHash]
        );
      }
    });

    return {
      message: 'Password updated successfully.',
    };
  }

  static async revokeSession(userId, sessionId) {
    const existing = await query(
      'SELECT id, is_revoked FROM user_sessions WHERE id = ? AND user_id = ? LIMIT 1',
      [sessionId, userId]
    );

    if (existing.length === 0) {
      const err = new Error('Session not found.');
      err.statusCode = 404;
      err.code = 'SESSION_NOT_FOUND';
      throw err;
    }

    await query(
      'UPDATE user_sessions SET is_revoked = 1 WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );

    return { message: 'Session revoked successfully.', sessionId };
  }

  static async revokeOtherSessions(userId, currentRefreshToken) {
    if (!currentRefreshToken || typeof currentRefreshToken !== 'string') {
      const err = new Error('currentRefreshToken is required to preserve the current session.');
      err.statusCode = 400;
      err.code = 'MISSING_CURRENT_REFRESH_TOKEN';
      throw err;
    }

    const currentHash = sha256(currentRefreshToken);
    const result = await query(
      'UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ? AND refresh_token_hash <> ? AND is_revoked = 0',
      [userId, currentHash]
    );

    return {
      revokedCount: result.affectedRows || 0,
      message: `Signed out of ${result.affectedRows || 0} other device(s).`,
    };
  }
}
