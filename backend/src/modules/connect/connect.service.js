import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from '../../config/db.js';
import { env } from '../../config/env.js';

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_DURATION_MS = 60 * 1000; // 1 minute lockout after 5 fails

function createServiceError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function normalizePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  // Strip non-digit characters except leading +
  const cleaned = rawPhone.trim().replace(/[\s\-\(\)\.]/g, '');
  // If Indian 10-digit number without country code, optionally match standard 10 digits
  return cleaned;
}

export class ConnectService {
  // ==========================================
  // 1. SECURITY & APP LOCK
  // ==========================================

  static async getSecurityStatus(userId) {
    const [row] = await query(
      'SELECT pin_hash, biometric_enabled, auto_lock_delay FROM connect_security_settings WHERE user_id = ? LIMIT 1',
      [userId]
    );

    return {
      isConfigured: Boolean(row?.pin_hash),
      biometricEnabled: Boolean(row?.biometric_enabled ?? 1),
      autoLockDelay: row?.auto_lock_delay || 'immediate',
    };
  }

  static async setupSecurityPin(userId, payload) {
    const { pin, currentPin, biometricEnabled, autoLockDelay } = payload;
    const [existing] = await query(
      'SELECT pin_hash FROM connect_security_settings WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (existing?.pin_hash) {
      if (!currentPin) {
        throw createServiceError('Current Connect PIN is required to change your PIN.', 400, 'CURRENT_PIN_REQUIRED');
      }
      if (!(await bcrypt.compare(currentPin, existing.pin_hash))) {
        throw createServiceError('Current Connect PIN is incorrect.', 401, 'INVALID_PIN');
      }
    }
    const pinHash = await bcrypt.hash(pin, 10);

    await query(
      `INSERT INTO connect_security_settings (
         user_id, pin_hash, biometric_enabled, auto_lock_delay, failed_attempts, locked_until
       ) VALUES (?, ?, ?, ?, 0, NULL)
       ON DUPLICATE KEY UPDATE
         pin_hash = VALUES(pin_hash),
         biometric_enabled = VALUES(biometric_enabled),
         auto_lock_delay = VALUES(auto_lock_delay),
         failed_attempts = 0,
         locked_until = NULL`,
      [userId, pinHash, biometricEnabled ? 1 : 0, autoLockDelay || 'immediate']
    );

    return {
      success: true,
      isConfigured: true,
      biometricEnabled: Boolean(biometricEnabled),
      autoLockDelay: autoLockDelay || 'immediate',
      connectToken: this.issueConnectToken(userId),
    };
  }

  static issueConnectToken(userId) {
    return jwt.sign({ sub: userId, scope: 'my_connect' }, env.jwt.accessSecret, { expiresIn: '15m' });
  }

  static async verifySecurityPin(userId, pin) {
    const [row] = await query(
      'SELECT pin_hash, failed_attempts, locked_until FROM connect_security_settings WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (!row || !row.pin_hash) {
      throw createServiceError('My Connect PIN is not configured yet.', 400, 'PIN_NOT_CONFIGURED');
    }

    const now = Date.now();
    if (row.locked_until && Number(row.locked_until) > now) {
      const waitSec = Math.ceil((Number(row.locked_until) - now) / 1000);
      throw createServiceError(
        `Too many incorrect attempts. Please try again in ${waitSec}s.`,
        429,
        'PIN_LOCKED_TEMPORARY'
      );
    }

    const isMatch = await bcrypt.compare(pin, row.pin_hash);

    if (!isMatch) {
      const nextAttempts = (row.failed_attempts || 0) + 1;
      let lockUntil = null;
      if (nextAttempts >= PIN_MAX_ATTEMPTS) {
        lockUntil = now + PIN_LOCK_DURATION_MS;
      }

      await query(
        'UPDATE connect_security_settings SET failed_attempts = ?, locked_until = ? WHERE user_id = ?',
        [nextAttempts >= PIN_MAX_ATTEMPTS ? 0 : nextAttempts, lockUntil, userId]
      );

      if (lockUntil) {
        throw createServiceError(
          'Too many incorrect attempts. Connect is locked for 60 seconds.',
          429,
          'PIN_LOCKED_TEMPORARY'
        );
      }

      const remaining = PIN_MAX_ATTEMPTS - nextAttempts;
      throw createServiceError(
        `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        401,
        'INVALID_PIN'
      );
    }

    // Reset attempts on successful entry
    await query(
      'UPDATE connect_security_settings SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?',
      [userId]
    );

    return { success: true, verified: true, connectToken: this.issueConnectToken(userId) };
  }

  // ==========================================
  // 2. CONTACTS & PHONE ADDRESS BOOK SYNC
  // ==========================================

  static async syncPhoneContacts(userId, contactsList = []) {
    if (!contactsList.length) {
      return { registeredUsers: [], otherContacts: [] };
    }

    // Build lookup maps for numbers
    const phoneToNameMap = new Map();
    const cleanNumbers = [];

    for (const c of contactsList) {
      const clean = normalizePhone(c.phone);
      if (clean && clean.length >= 7) {
        phoneToNameMap.set(clean, c.name || clean);
        cleanNumbers.push(clean);

        // Also check last 10 digits for local/national formats (e.g. +91 9876543210 -> 9876543210)
        if (clean.length > 10) {
          const last10 = clean.slice(-10);
          phoneToNameMap.set(last10, c.name || clean);
          cleanNumbers.push(last10);
        }
      }
    }

    if (cleanNumbers.length === 0) {
      return { registeredUsers: [], otherContacts: contactsList };
    }

    // Query users matching phone numbers (excluding self)
    const placeholders = cleanNumbers.map(() => '?').join(',');
    const matchingUsers = await query(
      `SELECT id, name, phone, email, profile_image, headline
       FROM users
       WHERE id != ? AND account_status = 'active'
         AND email NOT LIKE '%@lifeos.internal'
         AND (
           REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') IN (${placeholders}) OR
           RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), 10) IN (${placeholders})
         )
       LIMIT 500`,
      [userId, ...cleanNumbers, ...cleanNumbers]
    );

    const registeredUserIds = new Set(matchingUsers.map((u) => u.id));
    const registeredPhoneKeys = new Set();

    const registeredUsers = matchingUsers.map((u) => {
      const cleanUPhone = normalizePhone(u.phone);
      registeredPhoneKeys.add(cleanUPhone);
      if (cleanUPhone.length > 10) registeredPhoneKeys.add(cleanUPhone.slice(-10));

      const phoneBookName =
        phoneToNameMap.get(cleanUPhone) ||
        phoneToNameMap.get(cleanUPhone.slice(-10)) ||
        u.name;

      return {
        id: u.id,
        name: u.name,
        phoneBookName,
        phone: u.phone,
        email: u.email,
        profileImage: u.profile_image,
        headline: u.headline || 'Hey there! I am using Life OS',
        isRegistered: true,
      };
    });

    // Auto-save registered contacts in connect_contacts table
    for (const reg of registeredUsers) {
      const contactRecordId = crypto.randomUUID();
      await query(
        `INSERT INTO connect_contacts (id, user_id, contact_user_id, custom_name, phone_number)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           custom_name = VALUES(custom_name),
           phone_number = VALUES(phone_number)`,
        [contactRecordId, userId, reg.id, reg.phoneBookName, reg.phone]
      );
    }

    // Filter remaining contacts as "Invite to Life OS"
    const seenOtherPhones = new Set();
    const otherContacts = [];
    for (const c of contactsList) {
      const clean = normalizePhone(c.phone);
      const last10 = clean.slice(-10);
      if (!registeredPhoneKeys.has(clean) && !registeredPhoneKeys.has(last10) && !seenOtherPhones.has(clean)) {
        seenOtherPhones.add(clean);
        otherContacts.push({
          name: c.name || c.phone,
          phone: c.phone,
          isRegistered: false,
        });
      }
    }

    return {
      registeredUsers,
      otherContacts: otherContacts.slice(0, 300),
    };
  }

  static async searchUsers(userId, searchKeyword) {
    const q = String(searchKeyword || '').trim();
    if (!q) return [];

    const rows = await query(
      `SELECT id, name, phone, email, profile_image, headline
       FROM users
       WHERE account_status = 'active'
         AND email NOT LIKE '%@lifeos.internal'
         AND id <> ?
         AND (
           name LIKE ? OR
           email LIKE ? OR
           phone LIKE ?
         )
       LIMIT 20`,
      [userId, `%${q}%`, `%${q}%`, `%${q}%`]
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.id === userId ? `${r.name} (You)` : r.name,
      // Global name search must not reveal account contact details.
      phone: null,
      email: null,
      profileImage: r.profile_image,
      headline: r.id === userId ? 'Message yourself' : (r.headline || 'Hey there! I am using Life OS'),
      isSelf: r.id === userId,
    }));
  }

  // ==========================================
  // 3. CONVERSATIONS
  // ==========================================

  static async listConversations(userId, filter = 'all') {
    // 1. Fetch conversations this user is a member of
    const convRows = await query(
      `SELECT
         c.id,
         c.type,
         c.name AS group_name,
         c.icon AS group_icon,
         c.description,
         c.created_by,
         c.last_message_text,
         c.last_message_sender_id,
         c.last_message_at,
         c.updated_at,
         cm.role,
         cm.is_muted,
         cm.is_pinned,
         cm.is_favorite,
         cm.last_read_at
       FROM connect_conversation_members cm
       JOIN connect_conversations c ON c.id = cm.conversation_id
       WHERE cm.user_id = ?
       ORDER BY cm.is_pinned DESC, COALESCE(c.last_message_at, c.created_at) DESC`,
      [userId]
    );

    if (convRows.length === 0) return [];

    const convIds = convRows.map((r) => r.id);
    const placeholders = convIds.map(() => '?').join(',');

    // 2. Fetch all members for these conversations (to get names/avatars of direct chat partners)
    const memberRows = await query(
      `SELECT
         cm.conversation_id,
         cm.user_id,
         cm.role,
         u.name,
         u.profile_image,
         u.headline,
         u.phone
       FROM connect_conversation_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id IN (${placeholders})`,
      convIds
    );

    // Group members by conversation ID
    const membersByConv = new Map();
    for (const m of memberRows) {
      if (!membersByConv.has(m.conversation_id)) {
        membersByConv.set(m.conversation_id, []);
      }
      membersByConv.get(m.conversation_id).push(m);
    }

    // Heal duplicate direct threads created before pair-level locking was
    // added. Hiding a duplicate list row alone strands its message history.
    const directByPartner = new Map();
    for (const conv of convRows) {
      if (conv.type !== 'direct') continue;
      const other = (membersByConv.get(conv.id) || []).find((m) => m.user_id !== userId);
      if (!other) continue;
      const ids = directByPartner.get(other.user_id) || [];
      ids.push(conv.id);
      directByPartner.set(other.user_id, ids);
    }
    const duplicatePartners = Array.from(directByPartner.entries()).filter(([, ids]) => ids.length > 1);
    if (duplicatePartners.length > 0) {
      for (const [partnerId] of duplicatePartners) {
        await this.getOrCreateDirectConversation(userId, partnerId);
      }
      return this.listConversations(userId, filter);
    }

    // 3. Calculate unread counts for each conversation
    const unreadRows = await query(
      `SELECT
         m.conversation_id,
         COUNT(*) AS unread_count
       FROM connect_messages m
       JOIN connect_conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
       WHERE m.sender_id != ?
         AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
       GROUP BY m.conversation_id`,
      [userId, userId]
    );

    const unreadMap = new Map(unreadRows.map((u) => [u.conversation_id, Number(u.unread_count || 0)]));

    // Format list
    const results = convRows.map((c) => {
      const allMembers = membersByConv.get(c.id) || [];
      const isGroup = c.type === 'group';
      const unreadCount = unreadMap.get(c.id) || 0;

      let displayName = c.group_name || 'Group Chat';
      let displayAvatar = c.group_icon || null;
      let displayHeadline = c.description || `${allMembers.length} members`;
      let partnerUserId = null;

      if (!isGroup) {
        // Direct 1-to-1: Pick the other participant
        const otherMember = allMembers.find((m) => m.user_id !== userId);
        if (otherMember) {
          displayName = otherMember.name || 'User';
          displayAvatar = otherMember.profile_image || null;
          displayHeadline = otherMember.headline || 'Hey there! I am using Life OS';
          partnerUserId = otherMember.user_id;
        } else if (allMembers.length > 0) {
          // Self-conversation: Message Yourself
          displayName = `${allMembers[0].name} (You)`;
          displayAvatar = allMembers[0].profile_image || null;
          displayHeadline = 'Message yourself';
          partnerUserId = userId;
        }
      }

      return {
        id: c.id,
        type: c.type,
        displayName,
        displayAvatar,
        displayHeadline,
        partnerUserId,
        isGroup,
        isPinned: Boolean(c.is_pinned),
        isFavorite: Boolean(c.is_favorite),
        isMuted: Boolean(c.is_muted),
        unreadCount,
        lastMessage: c.last_message_text,
        lastMessageSenderId: c.last_message_sender_id,
        lastMessageAt: c.last_message_at,
        membersCount: allMembers.length,
      };
    });

    // Deduplicate direct conversations by partnerUserId (keeping the most recently active)
    const seenPartners = new Set();
    const dedupedResults = [];
    for (const item of results) {
      if (!item.isGroup && item.partnerUserId) {
        if (seenPartners.has(item.partnerUserId)) continue;
        seenPartners.add(item.partnerUserId);
      }
      dedupedResults.push(item);
    }

    if (filter === 'unread') {
      return dedupedResults.filter((r) => r.unreadCount > 0);
    }
    if (filter === 'groups') {
      return dedupedResults.filter((r) => r.isGroup);
    }
    if (filter === 'favorites') {
      return dedupedResults.filter((r) => r.isFavorite);
    }

    return dedupedResults;
  }

  static async getOrCreateDirectConversation(userId, targetUserId) {
    // Both participants can open a new direct chat at the same time. Serialize
    // creation by the unordered user pair so both requests return one shared ID.
    const [firstUserId, secondUserId] = [String(userId), String(targetUserId)].sort();
    const lockName = `lifeos:direct:${crypto
      .createHash('sha256')
      .update(`${firstUserId}:${secondUserId}`)
      .digest('hex')
      .slice(0, 48)}`;
    const lockConnection = await pool.getConnection();
    let lockAcquired = false;

    try {
      const [rows] = await lockConnection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
      if (Number(rows[0]?.acquired) !== 1) {
        throw createServiceError('Could not safely open this conversation. Please try again.', 503, 'CONVERSATION_LOCK_TIMEOUT');
      }
      lockAcquired = true;
      return await this.getOrCreateDirectConversationLocked(userId, targetUserId);
    } finally {
      try {
        if (lockAcquired) {
          await lockConnection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
        }
      } finally {
        lockConnection.release();
      }
    }
  }

  static async getOrCreateDirectConversationLocked(userId, targetUserId) {
    const isSelf = userId === targetUserId;

    // Verify target user exists
    const [targetUser] = await query(
      'SELECT id, name, profile_image, headline, phone, email FROM users WHERE id = ? LIMIT 1',
      [targetUserId]
    );
    if (!targetUser) {
      throw createServiceError('User not found.', 404, 'USER_NOT_FOUND');
    }

    if (isSelf) {
      // Check if self-conversation already exists
      const [existingSelf] = await query(
        `SELECT c.id
         FROM connect_conversations c
         JOIN connect_conversation_members m ON m.conversation_id = c.id
         WHERE c.type = 'direct' AND c.created_by = ?
         GROUP BY c.id
         HAVING COUNT(m.id) = 1
         LIMIT 1`,
        [userId]
      );

      if (existingSelf?.id) {
        return {
          id: existingSelf.id,
          type: 'direct',
          displayName: `${targetUser.name} (You)`,
          displayAvatar: targetUser.profile_image,
          displayHeadline: 'Message yourself',
          partnerUserId: targetUser.id,
          isGroup: false,
        };
      }

      // Create new self-conversation (WhatsApp-style "Message yourself")
      const conversationId = crypto.randomUUID();
      await query(
        `INSERT INTO connect_conversations (id, type, created_by)
         VALUES (?, 'direct', ?)`,
        [conversationId, userId]
      );

      await query(
        `INSERT INTO connect_conversation_members (id, conversation_id, user_id, role)
         VALUES (?, ?, ?, 'admin')`,
        [crypto.randomUUID(), conversationId, userId]
      );

      return {
        id: conversationId,
        type: 'direct',
        displayName: `${targetUser.name} (You)`,
        displayAvatar: targetUser.profile_image,
        displayHeadline: 'Message yourself',
        partnerUserId: targetUser.id,
        isGroup: false,
      };
    }

    // Auto-migrate placeholder users: if targetUser is real and has a phone,
    // check if a placeholder user exists with the same phone number.
    // If so, reassign any conversations and messages from the placeholder to targetUser.
    if (targetUser.phone && !targetUser.email?.endsWith('@lifeos.internal')) {
      const cleanTargetPhone = normalizePhone(targetUser.phone);
      const targetLast10 = cleanTargetPhone.slice(-10);
      const placeholders = await query(
        `SELECT id FROM users
         WHERE id != ? AND email LIKE '%@lifeos.internal' AND (
           REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') = ? OR
           RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), 10) = ?
         )`,
        [targetUserId, cleanTargetPhone, targetLast10]
      );

      for (const ph of placeholders) {
        // Re-point conversation memberships
        await query(
          'UPDATE IGNORE connect_conversation_members SET user_id = ? WHERE user_id = ?',
          [targetUserId, ph.id]
        );
        await query('DELETE FROM connect_conversation_members WHERE user_id = ?', [ph.id]);
        // Re-point messages
        await query('UPDATE connect_messages SET sender_id = ? WHERE sender_id = ?', [targetUserId, ph.id]);
        // Clean up placeholder contact and user rows
        await query('DELETE FROM connect_contacts WHERE contact_user_id = ?', [ph.id]);
        await query('DELETE FROM users WHERE id = ?', [ph.id]);
      }
    }

    // Check if direct conversation(s) already exist between these 2 users
    const existingRows = await query(
      `SELECT c.id
       FROM connect_conversations c
       JOIN connect_conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
       JOIN connect_conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
       WHERE c.type = 'direct'
       ORDER BY c.created_at ASC`,
      [userId, targetUserId]
    );

    if (existingRows.length > 0) {
      const primaryConvId = existingRows[0].id;

      // If duplicate conversations exist between the same 2 users, consolidate them into primary
      if (existingRows.length > 1) {
        for (let i = 1; i < existingRows.length; i++) {
          const dupId = existingRows[i].id;
          await query(
            `UPDATE connect_conversation_members primary_member
             JOIN connect_conversation_members duplicate_member
               ON duplicate_member.user_id = primary_member.user_id
             SET primary_member.is_pinned = GREATEST(primary_member.is_pinned, duplicate_member.is_pinned),
                 primary_member.is_favorite = GREATEST(primary_member.is_favorite, duplicate_member.is_favorite),
                 primary_member.is_muted = GREATEST(primary_member.is_muted, duplicate_member.is_muted),
                 primary_member.last_read_at = GREATEST(primary_member.last_read_at, duplicate_member.last_read_at)
             WHERE primary_member.conversation_id = ? AND duplicate_member.conversation_id = ?`,
            [primaryConvId, dupId]
          );
          await query(
            `UPDATE connect_conversations primary_conv
             JOIN connect_conversations duplicate_conv ON duplicate_conv.id = ?
             SET primary_conv.last_message_text = duplicate_conv.last_message_text,
                 primary_conv.last_message_sender_id = duplicate_conv.last_message_sender_id,
                 primary_conv.last_message_at = duplicate_conv.last_message_at
             WHERE primary_conv.id = ?
               AND duplicate_conv.last_message_at IS NOT NULL
               AND (primary_conv.last_message_at IS NULL OR duplicate_conv.last_message_at > primary_conv.last_message_at)`,
            [dupId, primaryConvId]
          );
          // Move messages to primary conversation
          await query('UPDATE connect_messages SET conversation_id = ? WHERE conversation_id = ?', [primaryConvId, dupId]);
          // Remove duplicate members and conversation
          await query('DELETE FROM connect_conversation_members WHERE conversation_id = ?', [dupId]);
          await query('DELETE FROM connect_conversations WHERE id = ?', [dupId]);
        }
      }

      return {
        id: primaryConvId,
        type: 'direct',
        displayName: targetUser.name,
        displayAvatar: targetUser.profile_image,
        displayHeadline: targetUser.headline,
        partnerUserId: targetUser.id,
        isGroup: false,
      };
    }

    // Create new direct conversation
    const conversationId = crypto.randomUUID();
    await query(
      `INSERT INTO connect_conversations (id, type, created_by)
       VALUES (?, 'direct', ?)`,
      [conversationId, userId]
    );

    // Add both members
    await query(
      `INSERT INTO connect_conversation_members (id, conversation_id, user_id, role)
       VALUES
         (?, ?, ?, 'admin'),
         (?, ?, ?, 'member')`,
      [crypto.randomUUID(), conversationId, userId, crypto.randomUUID(), conversationId, targetUserId]
    );

    return {
      id: conversationId,
      type: 'direct',
      displayName: targetUser.name,
      displayAvatar: targetUser.profile_image,
      displayHeadline: targetUser.headline,
      partnerUserId: targetUser.id,
      isGroup: false,
    };
  }

  static async getOrCreateContactConversation(userId, { name, phone }) {
    if (!phone || typeof phone !== 'string') {
      throw createServiceError('Phone number is required.', 400, 'PHONE_REQUIRED');
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      throw createServiceError('Invalid phone number.', 400, 'INVALID_PHONE');
    }

    const last10 = cleanPhone.slice(-10);

    // 1. Check if user exists in database with this phone (prefer registered real user over placeholder)
    const [existingUser] = await query(
      `SELECT id, name, profile_image, headline, phone, email
       FROM users
       WHERE (
         REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') = ? OR
         RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), 10) = ?
       )
       ORDER BY (email NOT LIKE '%@lifeos.internal') DESC, created_at DESC
       LIMIT 1`,
      [cleanPhone, last10]
    );

    let targetUserId = existingUser?.id;

    if (!targetUserId) {
      // 2. Create contact placeholder user
      targetUserId = crypto.randomUUID();
      const placeholderEmail = `contact_${cleanPhone}_${Date.now()}@lifeos.internal`;
      const dummyHash = '$2a$10$e8wF4r2Mek1JdJz0O69EieaJvR1zLkqk6Kz8Bw5hZ9Pz2B0T6Uj2i';
      const contactDisplayName = (name && String(name).trim()) || cleanPhone;

      try {
        await query(
          `INSERT INTO users (id, name, email, phone, password_hash, headline, account_status)
           VALUES (?, ?, ?, ?, ?, 'Phone Contact', 'active')`,
          [targetUserId, contactDisplayName, placeholderEmail, cleanPhone, dummyHash]
        );
      } catch {
        // If already exists or race condition, fetch existing id
        const [recheck] = await query(
          `SELECT id FROM users
           WHERE (
             REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', '') = ? OR
             RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), 10) = ?
           )
           ORDER BY (email NOT LIKE '%@lifeos.internal') DESC
           LIMIT 1`,
          [cleanPhone, last10]
        );
        if (recheck?.id) {
          targetUserId = recheck.id;
        }
      }
    }

    // 3. Save / update custom name in connect_contacts
    const contactRecordId = crypto.randomUUID();
    await query(
      `INSERT INTO connect_contacts (id, user_id, contact_user_id, custom_name, phone_number)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         custom_name = VALUES(custom_name),
         phone_number = VALUES(phone_number)`,
      [contactRecordId, userId, targetUserId, name || null, cleanPhone]
    );

    // 4. Return direct conversation
    return this.getOrCreateDirectConversation(userId, targetUserId);
  }

  static async createGroupConversation(userId, payload) {
    const { name, icon, memberIds = [], description = '' } = payload;
    const uniqueMembers = Array.from(new Set(memberIds.map(String))).filter((id) => id !== String(userId));
    if (uniqueMembers.length < 1 || uniqueMembers.length > 100) {
      throw createServiceError('A group must include between 1 and 100 other members.', 400, 'INVALID_GROUP_SIZE');
    }
    const memberSlots = uniqueMembers.map(() => '?').join(',');
    const validMembers = await query(
      `SELECT id FROM users
       WHERE account_status = 'active'
         AND email NOT LIKE '%@lifeos.internal'
         AND id IN (${memberSlots})`,
      uniqueMembers
    );
    if (validMembers.length !== uniqueMembers.length) {
      throw createServiceError('One or more selected group members are unavailable.', 400, 'INVALID_GROUP_MEMBER');
    }
    const conversationId = crypto.randomUUID();

    await query(
      `INSERT INTO connect_conversations (id, type, name, icon, description, created_by)
       VALUES (?, 'group', ?, ?, ?, ?)`,
      [conversationId, name, icon || null, description || null, userId]
    );

    // Add creator as admin
    await query(
      `INSERT INTO connect_conversation_members (id, conversation_id, user_id, role)
       VALUES (?, ?, ?, 'admin')`,
      [crypto.randomUUID(), conversationId, userId]
    );

    // Add other members
    for (const memId of uniqueMembers) {
      await query(
        `INSERT INTO connect_conversation_members (id, conversation_id, user_id, role)
         VALUES (?, ?, ?, 'member')`,
        [crypto.randomUUID(), conversationId, memId]
      );
    }

    // Add initial system message
    const [creator] = await query('SELECT name FROM users WHERE id = ? LIMIT 1', [userId]);
    const sysMsgId = crypto.randomUUID();
    const sysMsgText = `${creator?.name || 'Someone'} created group "${name}"`;

    await query(
      `INSERT INTO connect_messages (id, conversation_id, sender_id, message_type, content, status)
       VALUES (?, ?, ?, 'system', ?, 'read')`,
      [sysMsgId, conversationId, userId, sysMsgText]
    );

    await query(
      `UPDATE connect_conversations
       SET last_message_text = ?, last_message_sender_id = ?, last_message_at = NOW()
       WHERE id = ?`,
      [sysMsgText, userId, conversationId]
    );

    return {
      id: conversationId,
      type: 'group',
      displayName: name,
      displayAvatar: icon || null,
      displayHeadline: `${uniqueMembers.length + 1} members`,
      isGroup: true,
      membersCount: uniqueMembers.length + 1,
    };
  }

  // ==========================================
  // 4. MESSAGES & HISTORY
  // ==========================================

  static async getMessages(userId, conversationId, options = {}) {
    // Verify membership
    const [membership] = await query(
      'SELECT id, role, last_read_at FROM connect_conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1',
      [conversationId, userId]
    );
    if (!membership) {
      throw createServiceError('You are not a member of this conversation.', 403, 'NOT_A_MEMBER');
    }

    const parsedLimit = Number.isInteger(options.limit)
      ? options.limit
      : Number.parseInt(options.limit, 10) || 50;
    const safeLimit = Math.min(Math.max(parsedLimit, 1), 100);
    const beforeId = options.beforeId ? String(options.beforeId).trim() : null;

    let timeFilter = '';
    const params = [conversationId];

    if (beforeId) {
      const [refMsg] = await query('SELECT created_at FROM connect_messages WHERE id = ? LIMIT 1', [beforeId]);
      if (refMsg?.created_at) {
        timeFilter = 'AND m.created_at < ?';
        params.push(refMsg.created_at);
      }
    }

    // Inline validated integer for LIMIT because TiDB prepared statements reject parameter placeholders in LIMIT ?
    const rows = await query(
      `SELECT
         m.id,
         m.conversation_id,
         m.sender_id,
         m.message_type,
         m.content,
         m.media_url,
         m.file_name,
         m.file_size,
         m.mime_type,
         m.media_duration,
         m.thumbnail_url,
         m.status,
         m.reply_to_id,
         m.created_at,
         u.name AS sender_name,
         u.profile_image AS sender_avatar
       FROM connect_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? ${timeFilter}
       ORDER BY m.created_at DESC
       LIMIT ${safeLimit}`,
      params
    );

    // Update member's last_read_at
    await query(
      `UPDATE connect_conversation_members
       SET last_read_at = NOW()
       WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, userId]
    );

    // Update incoming messages status to 'read'
    await query(
      `UPDATE connect_messages
       SET status = 'read'
       WHERE conversation_id = ? AND sender_id != ? AND status != 'read'`,
      [conversationId, userId]
    );

    return rows.reverse().map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      senderAvatar: r.sender_avatar,
      messageType: r.message_type,
      content: r.content,
      mediaUrl: r.media_url || null,
      fileName: r.file_name || null,
      fileSize: r.file_size !== null && r.file_size !== undefined ? Number(r.file_size) : null,
      mimeType: r.mime_type || null,
      mediaDuration: r.media_duration !== null && r.media_duration !== undefined ? Number(r.media_duration) : null,
      thumbnailUrl: r.thumbnail_url || null,
      status: r.status,
      replyToId: r.reply_to_id,
      createdAt: r.created_at,
      isOutgoing: r.sender_id === userId,
    }));
  }

  static async uploadMedia(userId, { fileName, base64Data, mediaType, mimeType, duration }) {
    if (!fileName || !base64Data) {
      throw createServiceError('File name and base64 data are required.', 400, 'INVALID_UPLOAD_PAYLOAD');
    }

    const cleanName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const now = new Date();
    const subDir = path.join('uploads', 'connect', `${now.getFullYear()}`, `${String(now.getMonth() + 1).padStart(2, '0')}`);
    const fullDirPath = path.join(process.cwd(), subDir);
    await fs.promises.mkdir(fullDirPath, { recursive: true });

    const pureBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(pureBase64, 'base64');

    const uniqueFileName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${cleanName}`;
    const filePath = path.join(fullDirPath, uniqueFileName);
    await fs.promises.writeFile(filePath, buffer);

    const relativeUrl = `/${subDir.replace(/\\/g, '/')}/${uniqueFileName}`;

    return {
      mediaUrl: relativeUrl,
      fileName: cleanName,
      fileSize: buffer.length,
      mimeType: mimeType || 'application/octet-stream',
      mediaType: mediaType || 'document',
      mediaDuration: duration ? Number(duration) : null,
    };
  }

  static async sendMessage(userId, conversationId, payload) {
    const {
      content = '',
      messageType = 'text',
      mediaUrl = null,
      fileName = null,
      fileSize = null,
      mimeType = null,
      mediaDuration = null,
      thumbnailUrl = null,
      replyToId = null,
    } = payload;

    // Verify membership
    const [membership] = await query(
      'SELECT id FROM connect_conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1',
      [conversationId, userId]
    );
    if (!membership) {
      throw createServiceError('You are not a member of this conversation.', 403, 'NOT_A_MEMBER');
    }

    const messageId = crypto.randomUUID();

    await query(
      `INSERT INTO connect_messages (
         id, conversation_id, sender_id, message_type, content,
         media_url, file_name, file_size, mime_type, media_duration, thumbnail_url,
         status, reply_to_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?)`,
      [
        messageId,
        conversationId,
        userId,
        messageType,
        content,
        mediaUrl,
        fileName,
        fileSize,
        mimeType,
        mediaDuration,
        thumbnailUrl,
        replyToId,
      ]
    );

    // Build WhatsApp-style snippet for conversation list
    let snippet = content;
    if (messageType === 'image') {
      snippet = content ? `📷 ${content}` : '📷 Photo';
    } else if (messageType === 'video') {
      snippet = content ? `🎥 ${content}` : '🎥 Video';
    } else if (messageType === 'audio') {
      snippet = mediaDuration ? `🎤 Voice message (${mediaDuration}s)` : '🎤 Voice message';
    } else if (messageType === 'document') {
      snippet = fileName ? `📄 ${fileName}` : '📄 Document';
    }

    // Update conversation last message snippet
    await query(
      `UPDATE connect_conversations
       SET last_message_text = ?, last_message_sender_id = ?, last_message_at = NOW()
       WHERE id = ?`,
      [snippet.slice(0, 200), userId, conversationId]
    );

    // Fetch created message with sender profile
    const [msgRow] = await query(
      `SELECT
         m.id,
         m.conversation_id,
         m.sender_id,
         m.message_type,
         m.content,
         m.media_url,
         m.file_name,
         m.file_size,
         m.mime_type,
         m.media_duration,
         m.thumbnail_url,
         m.status,
         m.reply_to_id,
         m.created_at,
         u.name AS sender_name,
         u.profile_image AS sender_avatar
       FROM connect_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.id = ? LIMIT 1`,
      [messageId]
    );

    // Fetch other members in this conversation to broadcast via socket
    const otherMembers = await query(
      'SELECT user_id FROM connect_conversation_members WHERE conversation_id = ? AND user_id != ?',
      [conversationId, userId]
    );

    const messageObj = {
      id: msgRow.id,
      conversationId: msgRow.conversation_id,
      senderId: msgRow.sender_id,
      senderName: msgRow.sender_name,
      senderAvatar: msgRow.sender_avatar,
      messageType: msgRow.message_type,
      content: msgRow.content,
      mediaUrl: msgRow.media_url || null,
      fileName: msgRow.file_name || null,
      fileSize: msgRow.file_size !== null && msgRow.file_size !== undefined ? Number(msgRow.file_size) : null,
      mimeType: msgRow.mime_type || null,
      mediaDuration: msgRow.media_duration !== null && msgRow.media_duration !== undefined ? Number(msgRow.media_duration) : null,
      thumbnailUrl: msgRow.thumbnail_url || null,
      status: msgRow.status,
      replyToId: msgRow.reply_to_id,
      createdAt: msgRow.created_at,
      isOutgoing: true,
    };

    return {
      message: messageObj,
      recipientUserIds: otherMembers.length > 0 ? otherMembers.map((m) => m.user_id) : [userId],
    };
  }

  static async markConversationRead(userId, conversationId) {
    const [membership] = await query(
      'SELECT id FROM connect_conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1',
      [conversationId, userId]
    );
    if (!membership) {
      throw createServiceError('You are not a member of this conversation.', 403, 'NOT_A_MEMBER');
    }

    await query(
      `UPDATE connect_conversation_members
       SET last_read_at = NOW()
       WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, userId]
    );

    await query(
      `UPDATE connect_messages
       SET status = 'read'
       WHERE conversation_id = ? AND sender_id != ? AND status != 'read'`,
      [conversationId, userId]
    );

    const otherMembers = await query(
      'SELECT user_id FROM connect_conversation_members WHERE conversation_id = ? AND user_id != ?',
      [conversationId, userId]
    );

    return {
      conversationId,
      readByUserId: userId,
      recipientUserIds: otherMembers.map((m) => m.user_id),
    };
  }

  static async markMessageDelivered(userId, conversationId, messageId) {
    const [msg] = await query(
      `SELECT m.sender_id, m.status
       FROM connect_messages m
       JOIN connect_conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = ?
       WHERE m.id = ? AND m.conversation_id = ? LIMIT 1`,
      [userId, messageId, conversationId]
    );

    if (!msg) {
      throw createServiceError('Message not found or you are not a conversation member.', 404, 'MESSAGE_NOT_FOUND');
    }
    if (msg.sender_id === userId) {
      throw createServiceError('A sender cannot acknowledge their own message.', 403, 'INVALID_DELIVERY_RECEIPT');
    }

    if (msg && msg.status === 'sent') {
      await query(
        "UPDATE connect_messages SET status = 'delivered' WHERE id = ? AND conversation_id = ? AND status = 'sent'",
        [messageId, conversationId]
      );
    }

    return {
      senderId: msg?.sender_id,
      conversationId,
      messageId,
    };
  }

  static async getConversationRecipientIds(userId, conversationId) {
    const [membership] = await query(
      'SELECT id FROM connect_conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1',
      [conversationId, userId]
    );
    if (!membership) {
      throw createServiceError('You are not a member of this conversation.', 403, 'NOT_A_MEMBER');
    }
    const members = await query(
      'SELECT user_id FROM connect_conversation_members WHERE conversation_id = ? AND user_id <> ?',
      [conversationId, userId]
    );
    return members.map((member) => member.user_id);
  }

  static async relayCallSignal(userId, callId, targetUserId, signal) {
    const [call] = await query(
      'SELECT caller_id, receiver_id, status FROM connect_calls WHERE id = ? LIMIT 1',
      [callId]
    );
    if (!call || call.status !== 'ongoing') {
      throw createServiceError('Active call not found.', 404, 'CALL_NOT_FOUND');
    }
    const otherUserId = call.caller_id === userId
      ? call.receiver_id
      : call.receiver_id === userId
        ? call.caller_id
        : null;
    if (!otherUserId || otherUserId !== targetUserId) {
      throw createServiceError('You are not a participant in this call.', 403, 'CALL_NOT_AUTHORIZED');
    }
    return { targetUserId: otherUserId, fromUserId: userId, callId, signal };
  }

  // ==========================================
  // 5. VOICE & VIDEO CALLS (PHASE 3)
  // ==========================================

  static async initiateCall(callerId, payload) {
    const { receiverId, conversationId, callType = 'voice' } = payload;

    if (callerId === receiverId) {
      throw createServiceError('Cannot call yourself.', 400, 'SELF_CALL_NOT_ALLOWED');
    }

    const [receiver] = await query(
      'SELECT id, name, profile_image, headline, phone FROM users WHERE id = ? LIMIT 1',
      [receiverId]
    );
    if (!receiver) {
      throw createServiceError('Receiver not found.', 404, 'USER_NOT_FOUND');
    }

    const [caller] = await query(
      'SELECT id, name, profile_image, headline, phone FROM users WHERE id = ? LIMIT 1',
      [callerId]
    );

    let activeConvId = conversationId;
    if (!activeConvId) {
      const conv = await this.getOrCreateDirectConversation(callerId, receiverId);
      activeConvId = conv.id;
    } else {
      const members = await query(
        'SELECT user_id FROM connect_conversation_members WHERE conversation_id = ? AND user_id IN (?, ?)',
        [activeConvId, callerId, receiverId]
      );
      if (members.length !== 2) {
        throw createServiceError('Call participants must belong to the selected conversation.', 403, 'CALL_NOT_AUTHORIZED');
      }
    }

    const callId = crypto.randomUUID();

    await query(
      `INSERT INTO connect_calls (
         id, caller_id, receiver_id, conversation_id, call_type, status, started_at
       ) VALUES (?, ?, ?, ?, ?, 'ringing', NOW())`,
      [callId, callerId, receiverId, activeConvId, callType]
    );

    return {
      callId,
      conversationId: activeConvId,
      callType,
      status: 'ringing',
      caller: {
        id: caller.id,
        name: caller.name,
        profileImage: caller.profile_image,
        headline: caller.headline,
      },
      receiver: {
        id: receiver.id,
        name: receiver.name,
        profileImage: receiver.profile_image,
        headline: receiver.headline,
      },
      startedAt: new Date().toISOString(),
    };
  }

  static async respondCall(receiverId, callId, { action }) {
    const [call] = await query(
      'SELECT * FROM connect_calls WHERE id = ? AND receiver_id = ? LIMIT 1',
      [callId, receiverId]
    );
    if (!call) {
      throw createServiceError('Call not found or you are not the receiver.', 404, 'CALL_NOT_FOUND');
    }

    const nextStatus = action === 'accept' ? 'ongoing' : action === 'busy' ? 'busy' : 'declined';
    const endedAtSql = action === 'accept' ? 'NULL' : 'NOW()';

    await query(
      `UPDATE connect_calls
       SET status = ?, ended_at = ${endedAtSql}
       WHERE id = ?`,
      [nextStatus, callId]
    );

    // If declined or busy, record call note in conversation
    if (action !== 'accept' && call.conversation_id) {
      const sysMsgId = crypto.randomUUID();
      const text = call.call_type === 'video' ? '🎥 Declined video call' : '📞 Declined voice call';
      await query(
        `INSERT INTO connect_messages (
           id, conversation_id, sender_id, message_type, content, status
         ) VALUES (?, ?, ?, 'system', ?, 'read')`,
        [sysMsgId, call.conversation_id, receiverId, text]
      );
      await query(
        `UPDATE connect_conversations
         SET last_message_text = ?, last_message_sender_id = ?, last_message_at = NOW()
         WHERE id = ?`,
        [text, receiverId, call.conversation_id]
      );
    }

    return {
      callId,
      callerId: call.caller_id,
      receiverId: call.receiver_id,
      conversationId: call.conversation_id,
      callType: call.call_type,
      status: nextStatus,
    };
  }

  static async endCall(userId, callId, { durationSeconds = 0 }) {
    const [call] = await query(
      'SELECT * FROM connect_calls WHERE id = ? AND (caller_id = ? OR receiver_id = ?) LIMIT 1',
      [callId, userId, userId]
    );
    if (!call) {
      throw createServiceError('Call not found or unauthorized.', 404, 'CALL_NOT_FOUND');
    }

    const isCaller = call.caller_id === userId;
    const otherUserId = isCaller ? call.receiver_id : call.caller_id;
    const finalDuration = Math.max(0, Number(durationSeconds) || 0);

    let finalStatus = 'completed';
    if (call.status === 'ringing') {
      finalStatus = isCaller ? 'missed' : 'declined';
    } else if (finalDuration === 0 && call.status !== 'ongoing') {
      finalStatus = 'missed';
    }

    await query(
      `UPDATE connect_calls
       SET status = ?, ended_at = NOW(), duration_seconds = ?
       WHERE id = ?`,
      [finalStatus, finalDuration, callId]
    );

    // Add WhatsApp-style call summary into the conversation messages
    if (call.conversation_id) {
      let msgText = '';
      const icon = call.call_type === 'video' ? '🎥' : '📞';
      const callName = call.call_type === 'video' ? 'Video call' : 'Voice call';

      if (finalStatus === 'missed') {
        msgText = `${icon} Missed ${callName.toLowerCase()}`;
      } else if (finalStatus === 'declined') {
        msgText = `${icon} Declined ${callName.toLowerCase()}`;
      } else {
        const mins = Math.floor(finalDuration / 60);
        const secs = finalDuration % 60;
        const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        msgText = `${icon} ${callName}, ${durStr}`;
      }

      const callMsgId = crypto.randomUUID();
      await query(
        `INSERT INTO connect_messages (
           id, conversation_id, sender_id, message_type, content, status
         ) VALUES (?, ?, ?, 'system', ?, 'read')`,
        [callMsgId, call.conversation_id, call.caller_id, msgText]
      );

      await query(
        `UPDATE connect_conversations
         SET last_message_text = ?, last_message_sender_id = ?, last_message_at = NOW()
         WHERE id = ?`,
        [msgText, call.caller_id, call.conversation_id]
      );
    }

    return {
      callId,
      callerId: call.caller_id,
      receiverId: call.receiver_id,
      otherUserId,
      conversationId: call.conversation_id,
      callType: call.call_type,
      status: finalStatus,
      durationSeconds: finalDuration,
    };
  }

  static async getCallHistory(userId, options = {}) {
    const parsedLimit = Number.isInteger(options.limit)
      ? options.limit
      : Number.parseInt(options.limit, 10) || 50;
    const safeLimit = Math.min(Math.max(parsedLimit, 1), 100);

    const rows = await query(
      `SELECT
         c.id,
         c.caller_id,
         c.receiver_id,
         c.conversation_id,
         c.call_type,
         c.status,
         c.started_at,
         c.ended_at,
         c.duration_seconds,
         c.created_at,
         u1.name AS caller_name,
         u1.profile_image AS caller_avatar,
         u1.phone AS caller_phone,
         u2.name AS receiver_name,
         u2.profile_image AS receiver_avatar,
         u2.phone AS receiver_phone
       FROM connect_calls c
       JOIN users u1 ON u1.id = c.caller_id
       JOIN users u2 ON u2.id = c.receiver_id
       WHERE c.caller_id = ? OR c.receiver_id = ?
       ORDER BY c.created_at DESC
       LIMIT ${safeLimit}`,
      [userId, userId]
    );

    return rows.map((r) => {
      const isOutgoing = r.caller_id === userId;
      return {
        id: r.id,
        conversationId: r.conversation_id,
        callType: r.call_type,
        status: r.status,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        durationSeconds: r.duration_seconds || 0,
        createdAt: r.created_at,
        isOutgoing,
        contactUserId: isOutgoing ? r.receiver_id : r.caller_id,
        contactName: isOutgoing ? r.receiver_name : r.caller_name,
        contactAvatar: isOutgoing ? r.receiver_avatar : r.caller_avatar,
        contactPhone: isOutgoing ? r.receiver_phone : r.caller_phone,
      };
    });
  }
}
