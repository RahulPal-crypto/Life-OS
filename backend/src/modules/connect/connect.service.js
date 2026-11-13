import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';

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
    const { pin, biometricEnabled, autoLockDelay } = payload;
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
    };
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

    return { success: true, verified: true };
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
       WHERE id != ? AND (
         phone IN (${placeholders}) OR
         RIGHT(phone, 10) IN (${placeholders})
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
       WHERE id != ? AND (
         name LIKE ? OR
         email LIKE ? OR
         phone LIKE ?
       )
       LIMIT 20`,
      [userId, `%${q}%`, `%${q}%`, `%${q}%`]
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      profileImage: r.profile_image,
      headline: r.headline || 'Hey there! I am using Life OS',
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
        const otherMember = allMembers.find((m) => m.user_id !== userId) || allMembers[0];
        if (otherMember) {
          displayName = otherMember.name || 'User';
          displayAvatar = otherMember.profile_image || null;
          displayHeadline = otherMember.headline || 'Hey there! I am using Life OS';
          partnerUserId = otherMember.user_id;
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

    if (filter === 'unread') {
      return results.filter((r) => r.unreadCount > 0);
    }
    if (filter === 'groups') {
      return results.filter((r) => r.isGroup);
    }
    if (filter === 'favorites') {
      return results.filter((r) => r.isFavorite);
    }

    return results;
  }

  static async getOrCreateDirectConversation(userId, targetUserId) {
    if (userId === targetUserId) {
      throw createServiceError('Cannot start a direct conversation with yourself.', 400, 'SELF_CHAT_NOT_ALLOWED');
    }

    // Verify target user exists
    const [targetUser] = await query(
      'SELECT id, name, profile_image, headline, phone FROM users WHERE id = ? LIMIT 1',
      [targetUserId]
    );
    if (!targetUser) {
      throw createServiceError('User not found.', 404, 'USER_NOT_FOUND');
    }

    // Check if a direct conversation already exists between these 2 users
    const [existing] = await query(
      `SELECT c.id
       FROM connect_conversations c
       JOIN connect_conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = ?
       JOIN connect_conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = ?
       WHERE c.type = 'direct'
       LIMIT 1`,
      [userId, targetUserId]
    );

    if (existing?.id) {
      return {
        id: existing.id,
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

    // 1. Check if user exists in database with this phone
    const [existingUser] = await query(
      `SELECT id, name, profile_image, headline, phone
       FROM users
       WHERE phone = ? OR RIGHT(phone, 10) = ?
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
          `SELECT id FROM users WHERE phone = ? OR RIGHT(phone, 10) = ? LIMIT 1`,
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
    const uniqueMembers = Array.from(new Set(memberIds)).filter((id) => id !== userId);
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
      recipientUserIds: otherMembers.map((m) => m.user_id),
    };
  }

  static async markConversationRead(userId, conversationId) {
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
      'SELECT sender_id, status FROM connect_messages WHERE id = ? AND conversation_id = ? LIMIT 1',
      [messageId, conversationId]
    );

    if (msg && msg.status === 'sent') {
      await query(
        "UPDATE connect_messages SET status = 'delivered' WHERE id = ?",
        [messageId]
      );
    }

    return {
      senderId: msg?.sender_id,
      conversationId,
      messageId,
    };
  }
}
