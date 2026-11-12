import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/db.js';
import { env } from '../../config/env.js';

const LARGE_FILE_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20 MB
const VAULT_LOCK_MAX_ATTEMPTS = 5;
const VAULT_LOCK_COOLDOWN_MS = 30 * 1000;

const ORDER_BY_MAP = {
  newest: 'created_at DESC, memory_date DESC',
  oldest: 'created_at ASC, memory_date ASC',
  name_asc: 'file_name ASC, title ASC',
  size_desc: 'size_bytes DESC, created_at DESC',
  type: 'media_type ASC, file_name ASC',
};

function createServiceError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function issueVaultToken(userId) {
  return jwt.sign({ sub: userId, scope: 'memory_vault' }, env.jwt.accessSecret, {
    expiresIn: '15m',
  });
}

function assertValidVaultToken(userId, vaultToken) {
  if (!vaultToken || typeof vaultToken !== 'string') {
    throw createServiceError('Safe Vault is locked. Please unlock with PIN or biometric.', 403, 'VAULT_LOCKED');
  }
  try {
    const decoded = jwt.verify(vaultToken, env.jwt.accessSecret);
    if (decoded?.scope !== 'memory_vault' || decoded?.sub !== userId) {
      throw new Error('Invalid scope');
    }
  } catch {
    throw createServiceError('Safe Vault session expired. Please unlock again.', 403, 'VAULT_LOCKED');
  }
}

function formatFolderRow(row) {
  return {
    id: row.id,
    parentId: row.parent_id || null,
    name: row.name,
    color: row.color || '#7C3AED',
    icon: row.icon || '📁',
    isPinned: Boolean(row.is_pinned),
    isVault: Boolean(row.is_vault),
    isTrashed: Boolean(row.is_trashed),
    trashedAt: row.trashed_at ? Number(row.trashed_at) : null,
    itemCount: row.item_count !== undefined ? Number(row.item_count) : 0,
    totalBytes: row.total_bytes !== undefined ? Number(row.total_bytes) : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatItemRow(row) {
  return {
    id: row.id,
    folderId: row.folder_id || null,
    title: row.title,
    fileName: row.file_name,
    mediaType: row.media_type,
    mimeType: row.mime_type || null,
    sizeBytes: Number(row.size_bytes || 0),
    localUri: row.local_uri || null,
    vaultUri: row.vault_uri || null,
    driveFileId: row.drive_file_id || null,
    driveSynced: Boolean(row.drive_synced),
    story: row.story || null,
    memoryDate: row.memory_date,
    location: row.location || null,
    people: row.people || null,
    tags: row.tags || null,
    mood: row.mood || null,
    isFavorite: Boolean(row.is_favorite),
    isVault: Boolean(row.is_vault),
    isTrashed: Boolean(row.is_trashed),
    trashedAt: row.trashed_at ? Number(row.trashed_at) : null,
    linkedActivityId: row.linked_activity_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MemoriesService {
  static async getOverview(userId, filters, vaultToken) {
    const [vaultRow] = await query(
      'SELECT pin_hash, biometric_enabled FROM memory_vault_settings WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const vaultConfigured = Boolean(vaultRow?.pin_hash);

    if (filters.vault) {
      if (!vaultConfigured) {
        throw createServiceError('Safe Vault PIN is not set up yet.', 403, 'VAULT_NOT_CONFIGURED');
      }
      assertValidVaultToken(userId, vaultToken);
    }

    // Aggregate stats strictly excluding vault items from public counts
    const [statsRow] = await query(
      `SELECT
         COUNT(CASE WHEN is_vault = 0 AND is_trashed = 0 THEN 1 END) AS total_items,
         COALESCE(SUM(CASE WHEN is_vault = 0 AND is_trashed = 0 THEN size_bytes ELSE 0 END), 0) AS total_bytes,
         COUNT(CASE WHEN is_vault = 0 AND is_trashed = 0 AND media_type = 'photo' THEN 1 END) AS photo_count,
         COUNT(CASE WHEN is_vault = 0 AND is_trashed = 0 AND media_type = 'video' THEN 1 END) AS video_count,
         COUNT(CASE WHEN is_vault = 0 AND is_trashed = 0 AND media_type = 'document' THEN 1 END) AS document_count,
         COUNT(CASE WHEN is_vault = 0 AND is_trashed = 0 AND media_type = 'audio' THEN 1 END) AS audio_count,
         COUNT(CASE WHEN is_vault = 0 AND is_trashed = 0 AND is_favorite = 1 THEN 1 END) AS favorite_count,
         COUNT(CASE WHEN is_trashed = 1 AND is_vault = 0 THEN 1 END) AS trashed_count,
         COUNT(CASE WHEN is_vault = 0 AND is_trashed = 0 AND size_bytes >= ? THEN 1 END) AS large_count,
         COUNT(CASE WHEN is_vault = 0 AND is_trashed = 0 AND folder_id IS NULL THEN 1 END) AS unsorted_count,
         COUNT(CASE WHEN is_vault = 1 AND is_trashed = 0 THEN 1 END) AS vault_count,
         COALESCE(SUM(CASE WHEN is_vault = 1 AND is_trashed = 0 THEN size_bytes ELSE 0 END), 0) AS vault_bytes
       FROM memory_items
       WHERE user_id = ?`,
      [LARGE_FILE_THRESHOLD_BYTES, userId]
    );

    const onThisDayRows = filters.vault
      ? []
      : await query(
          `SELECT * FROM memory_items
           WHERE user_id = ? AND is_vault = 0 AND is_trashed = 0
             AND MONTH(memory_date) = MONTH(CURDATE())
             AND DAY(memory_date) = DAY(CURDATE())
             AND memory_date < CURDATE()
           ORDER BY memory_date DESC
           LIMIT 5`,
          [userId]
        );

    const folderScopeVault = filters.vault ? 1 : 0;
    const folderScopeTrashed = filters.trashed ? 1 : 0;

    const folderRows = await query(
      `SELECT f.*,
              COUNT(i.id) AS item_count,
              COALESCE(SUM(i.size_bytes), 0) AS total_bytes
       FROM memory_folders f
       LEFT JOIN memory_items i
         ON i.folder_id = f.id AND i.user_id = f.user_id AND i.is_trashed = f.is_trashed AND i.is_vault = f.is_vault
       WHERE f.user_id = ? AND f.is_vault = ? AND f.is_trashed = ?
       GROUP BY f.id
       ORDER BY f.is_pinned DESC, f.name ASC`,
      [userId, folderScopeVault, folderScopeTrashed]
    );

    // Item query
    const whereClauses = ['user_id = ?', 'is_vault = ?', 'is_trashed = ?'];
    const params = [userId, filters.vault ? 1 : 0, filters.trashed ? 1 : 0];

    if (!filters.trashed && !filters.category && !filters.favoritesOnly && !filters.largeOnly && !filters.unsortedOnly && !filters.search) {
      if (filters.folderId) {
        whereClauses.push('folder_id = ?');
        params.push(filters.folderId);
      } else {
        whereClauses.push('folder_id IS NULL');
      }
    } else if (filters.folderId) {
      whereClauses.push('folder_id = ?');
      params.push(filters.folderId);
    }

    if (filters.category) {
      whereClauses.push('media_type = ?');
      params.push(filters.category);
    }
    if (filters.favoritesOnly) {
      whereClauses.push('is_favorite = 1');
    }
    if (filters.largeOnly) {
      whereClauses.push('size_bytes >= ?');
      params.push(LARGE_FILE_THRESHOLD_BYTES);
    }
    if (filters.unsortedOnly) {
      whereClauses.push('folder_id IS NULL');
    }
    if (filters.search) {
      const like = `%${filters.search}%`;
      whereClauses.push(
        '(title LIKE ? OR file_name LIKE ? OR COALESCE(story, \'\') LIKE ? OR COALESCE(tags, \'\') LIKE ? OR COALESCE(location, \'\') LIKE ? OR COALESCE(people, \'\') LIKE ?)'
      );
      params.push(like, like, like, like, like, like);
    }

    const orderBy = ORDER_BY_MAP[filters.sort] || ORDER_BY_MAP.newest;
    const itemRows = await query(
      `SELECT * FROM memory_items WHERE ${whereClauses.join(' AND ')} ORDER BY ${orderBy} LIMIT 500`,
      params
    );

    return {
      stats: {
        totalItems: Number(statsRow?.total_items || 0),
        totalBytes: Number(statsRow?.total_bytes || 0),
        photoCount: Number(statsRow?.photo_count || 0),
        videoCount: Number(statsRow?.video_count || 0),
        documentCount: Number(statsRow?.document_count || 0),
        audioCount: Number(statsRow?.audio_count || 0),
        favoriteCount: Number(statsRow?.favorite_count || 0),
        trashedCount: Number(statsRow?.trashed_count || 0),
        largeCount: Number(statsRow?.large_count || 0),
        unsortedCount: Number(statsRow?.unsorted_count || 0),
        vaultCount: Number(statsRow?.vault_count || 0),
        vaultBytes: Number(statsRow?.vault_bytes || 0),
        vaultConfigured,
        biometricEnabled: vaultRow ? Boolean(vaultRow.biometric_enabled) : true,
      },
      onThisDay: onThisDayRows.map(formatItemRow),
      folders: folderRows.map(formatFolderRow),
      items: itemRows.map(formatItemRow),
    };
  }

  static async createFolder(userId, data, vaultToken) {
    if (data.isVault) {
      assertValidVaultToken(userId, vaultToken);
    }
    if (data.parentId) {
      const [parent] = await query(
        'SELECT id, is_vault FROM memory_folders WHERE id = ? AND user_id = ? LIMIT 1',
        [data.parentId, userId]
      );
      if (!parent) {
        throw createServiceError('Parent folder not found.', 404, 'PARENT_FOLDER_NOT_FOUND');
      }
      if (Boolean(parent.is_vault) !== Boolean(data.isVault)) {
        throw createServiceError('Cannot mix Safe Vault and regular folders.', 400, 'FOLDER_SCOPE_MISMATCH');
      }
    }

    const id = crypto.randomUUID();
    await query(
      `INSERT INTO memory_folders (id, user_id, parent_id, name, color, icon, is_pinned, is_vault)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        data.parentId,
        data.name,
        data.color,
        data.icon,
        data.isPinned ? 1 : 0,
        data.isVault ? 1 : 0,
      ]
    );

    const [created] = await query('SELECT * FROM memory_folders WHERE id = ?', [id]);
    return formatFolderRow(created);
  }

  static async updateFolder(userId, folderId, updates, vaultToken) {
    const [existing] = await query(
      'SELECT * FROM memory_folders WHERE id = ? AND user_id = ? LIMIT 1',
      [folderId, userId]
    );
    if (!existing) {
      throw createServiceError('Folder not found.', 404, 'FOLDER_NOT_FOUND');
    }
    if (existing.is_vault || updates.isVault) {
      assertValidVaultToken(userId, vaultToken);
    }

    const fields = [];
    const params = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.parentId !== undefined) {
      if (updates.parentId === folderId) {
        throw createServiceError('Folder cannot be inside itself.', 400, 'INVALID_PARENT_FOLDER');
      }
      fields.push('parent_id = ?');
      params.push(updates.parentId);
    }
    if (updates.color !== undefined) {
      fields.push('color = ?');
      params.push(updates.color);
    }
    if (updates.icon !== undefined) {
      fields.push('icon = ?');
      params.push(updates.icon);
    }
    if (updates.isPinned !== undefined) {
      fields.push('is_pinned = ?');
      params.push(updates.isPinned ? 1 : 0);
    }
    if (updates.isVault !== undefined) {
      fields.push('is_vault = ?');
      params.push(updates.isVault ? 1 : 0);
    }
    if (updates.isTrashed !== undefined) {
      fields.push('is_trashed = ?');
      params.push(updates.isTrashed ? 1 : 0);
      fields.push('trashed_at = ?');
      params.push(updates.isTrashed ? Date.now() : null);
    }

    if (fields.length > 0) {
      params.push(folderId, userId);
      await query(
        `UPDATE memory_folders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        params
      );
      if (updates.isTrashed !== undefined) {
        await query(
          'UPDATE memory_items SET is_trashed = ?, trashed_at = ? WHERE folder_id = ? AND user_id = ?',
          [updates.isTrashed ? 1 : 0, updates.isTrashed ? Date.now() : null, folderId, userId]
        );
      }
      if (updates.isVault !== undefined) {
        await query(
          'UPDATE memory_items SET is_vault = ? WHERE folder_id = ? AND user_id = ?',
          [updates.isVault ? 1 : 0, folderId, userId]
        );
      }
    }

    const [updated] = await query('SELECT * FROM memory_folders WHERE id = ?', [folderId]);
    return formatFolderRow(updated);
  }

  static async deleteFolder(userId, folderId, permanent, vaultToken) {
    const [existing] = await query(
      'SELECT * FROM memory_folders WHERE id = ? AND user_id = ? LIMIT 1',
      [folderId, userId]
    );
    if (!existing) {
      throw createServiceError('Folder not found.', 404, 'FOLDER_NOT_FOUND');
    }
    if (existing.is_vault) {
      assertValidVaultToken(userId, vaultToken);
    }

    if (permanent || existing.is_trashed) {
      await query('DELETE FROM memory_items WHERE folder_id = ? AND user_id = ?', [folderId, userId]);
      await query('DELETE FROM memory_folders WHERE parent_id = ? AND user_id = ?', [folderId, userId]);
      await query('DELETE FROM memory_folders WHERE id = ? AND user_id = ?', [folderId, userId]);
      return { deleted: true, permanent: true };
    }

    const now = Date.now();
    await query(
      'UPDATE memory_folders SET is_trashed = 1, trashed_at = ? WHERE id = ? AND user_id = ?',
      [now, folderId, userId]
    );
    await query(
      'UPDATE memory_items SET is_trashed = 1, trashed_at = ? WHERE folder_id = ? AND user_id = ?',
      [now, folderId, userId]
    );
    return { deleted: true, permanent: false };
  }

  static async createItem(userId, data, vaultToken) {
    if (data.isVault) {
      assertValidVaultToken(userId, vaultToken);
    }
    if (data.folderId) {
      const [folder] = await query(
        'SELECT id, is_vault FROM memory_folders WHERE id = ? AND user_id = ? LIMIT 1',
        [data.folderId, userId]
      );
      if (!folder) {
        throw createServiceError('Target folder not found.', 404, 'FOLDER_NOT_FOUND');
      }
      if (folder.is_vault && !data.isVault) {
        data.isVault = true;
        assertValidVaultToken(userId, vaultToken);
      }
    }

    const id = crypto.randomUUID();
    await query(
      `INSERT INTO memory_items (
        id, user_id, folder_id, title, file_name, media_type, mime_type, size_bytes,
        local_uri, vault_uri, drive_file_id, drive_synced, story, memory_date,
        location, people, tags, mood, is_favorite, is_vault, linked_activity_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        data.folderId,
        data.title,
        data.fileName,
        data.mediaType,
        data.mimeType,
        data.sizeBytes,
        data.localUri,
        data.vaultUri,
        data.driveFileId,
        data.driveSynced ? 1 : 0,
        data.story,
        data.memoryDate,
        data.location,
        data.people,
        data.tags,
        data.mood,
        data.isFavorite ? 1 : 0,
        data.isVault ? 1 : 0,
        data.linkedActivityId,
      ]
    );

    const [created] = await query('SELECT * FROM memory_items WHERE id = ?', [id]);
    return formatItemRow(created);
  }

  static async updateItem(userId, itemId, updates, vaultToken) {
    const [existing] = await query(
      'SELECT * FROM memory_items WHERE id = ? AND user_id = ? LIMIT 1',
      [itemId, userId]
    );
    if (!existing) {
      throw createServiceError('Memory item not found.', 404, 'ITEM_NOT_FOUND');
    }
    if (existing.is_vault || updates.isVault === false) {
      assertValidVaultToken(userId, vaultToken);
    }

    const fields = [];
    const params = [];
    const columnMap = {
      title: 'title',
      fileName: 'file_name',
      folderId: 'folder_id',
      story: 'story',
      location: 'location',
      people: 'people',
      tags: 'tags',
      mood: 'mood',
      localUri: 'local_uri',
      vaultUri: 'vault_uri',
      driveFileId: 'drive_file_id',
      memoryDate: 'memory_date',
    };

    for (const [key, col] of Object.entries(columnMap)) {
      if (updates[key] !== undefined) {
        fields.push(`${col} = ?`);
        params.push(updates[key]);
      }
    }

    if (updates.driveSynced !== undefined) {
      fields.push('drive_synced = ?');
      params.push(updates.driveSynced ? 1 : 0);
    }
    if (updates.isFavorite !== undefined) {
      fields.push('is_favorite = ?');
      params.push(updates.isFavorite ? 1 : 0);
    }
    if (updates.isVault !== undefined) {
      fields.push('is_vault = ?');
      params.push(updates.isVault ? 1 : 0);
    }
    if (updates.isTrashed !== undefined) {
      fields.push('is_trashed = ?');
      params.push(updates.isTrashed ? 1 : 0);
      fields.push('trashed_at = ?');
      params.push(updates.isTrashed ? Date.now() : null);
    }

    if (fields.length > 0) {
      params.push(itemId, userId);
      await query(
        `UPDATE memory_items SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        params
      );
    }

    const [updated] = await query('SELECT * FROM memory_items WHERE id = ?', [itemId]);
    return formatItemRow(updated);
  }

  static async bulkAction(userId, { action, itemIds, targetFolderId }, vaultToken) {
    const placeholders = itemIds.map(() => '?').join(', ');
    const rows = await query(
      `SELECT * FROM memory_items WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...itemIds]
    );

    if (rows.length === 0) {
      return { affected: 0, urisToDelete: [] };
    }

    const touchesVault = rows.some((r) => Boolean(r.is_vault)) || action === 'remove-from-vault';
    if (touchesVault) {
      assertValidVaultToken(userId, vaultToken);
    }

    if (action === 'move') {
      await query(
        `UPDATE memory_items SET folder_id = ? WHERE user_id = ? AND id IN (${placeholders})`,
        [targetFolderId, userId, ...itemIds]
      );
    } else if (action === 'copy') {
      for (const row of rows) {
        await query(
          `INSERT INTO memory_items (
            id, user_id, folder_id, title, file_name, media_type, mime_type, size_bytes,
            local_uri, vault_uri, story, memory_date, location, people, tags, mood, is_favorite, is_vault
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            userId,
            targetFolderId,
            `${row.title} (Copy)`,
            row.file_name,
            row.media_type,
            row.mime_type,
            row.size_bytes,
            row.local_uri,
            row.vault_uri,
            row.story,
            row.memory_date,
            row.location,
            row.people,
            row.tags,
            row.mood,
            row.is_favorite,
            row.is_vault,
          ]
        );
      }
    } else if (action === 'trash') {
      await query(
        `UPDATE memory_items SET is_trashed = 1, trashed_at = ? WHERE user_id = ? AND id IN (${placeholders})`,
        [Date.now(), userId, ...itemIds]
      );
    } else if (action === 'restore') {
      await query(
        `UPDATE memory_items SET is_trashed = 0, trashed_at = NULL WHERE user_id = ? AND id IN (${placeholders})`,
        [userId, ...itemIds]
      );
    } else if (action === 'delete-forever') {
      await query(
        `DELETE FROM memory_items WHERE user_id = ? AND id IN (${placeholders})`,
        [userId, ...itemIds]
      );
      return {
        affected: rows.length,
        urisToDelete: rows.map((r) => r.vault_uri || r.local_uri).filter(Boolean),
      };
    } else if (action === 'move-to-vault') {
      await query(
        `UPDATE memory_items SET is_vault = 1, folder_id = ? WHERE user_id = ? AND id IN (${placeholders})`,
        [targetFolderId, userId, ...itemIds]
      );
    } else if (action === 'remove-from-vault') {
      await query(
        `UPDATE memory_items SET is_vault = 0, folder_id = ? WHERE user_id = ? AND id IN (${placeholders})`,
        [targetFolderId, userId, ...itemIds]
      );
    } else if (action === 'favorite') {
      await query(
        `UPDATE memory_items SET is_favorite = 1 WHERE user_id = ? AND id IN (${placeholders})`,
        [userId, ...itemIds]
      );
    } else if (action === 'unfavorite') {
      await query(
        `UPDATE memory_items SET is_favorite = 0 WHERE user_id = ? AND id IN (${placeholders})`,
        [userId, ...itemIds]
      );
    }

    return { affected: rows.length, urisToDelete: [] };
  }

  static async setupVaultPin(userId, { pin, currentPin, biometricEnabled }) {
    const [existing] = await query(
      'SELECT * FROM memory_vault_settings WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (existing?.pin_hash) {
      if (!currentPin) {
        throw createServiceError('Current Vault PIN is required to change your PIN.', 400, 'CURRENT_PIN_REQUIRED');
      }
      const matches = await bcrypt.compare(currentPin, existing.pin_hash);
      if (!matches) {
        throw createServiceError('Current Vault PIN is incorrect.', 401, 'INVALID_VAULT_PIN');
      }
    }

    const pinHash = await bcrypt.hash(pin, 10);
    const biometricKey = crypto.randomBytes(32).toString('hex');
    const biometricKeyHash = await bcrypt.hash(biometricKey, 10);

    await query(
      `INSERT INTO memory_vault_settings (user_id, pin_hash, biometric_key_hash, biometric_enabled, failed_attempts, locked_until)
       VALUES (?, ?, ?, ?, 0, NULL)
       ON DUPLICATE KEY UPDATE
         pin_hash = VALUES(pin_hash),
         biometric_key_hash = VALUES(biometric_key_hash),
         biometric_enabled = VALUES(biometric_enabled),
         failed_attempts = 0,
         locked_until = NULL`,
      [userId, pinHash, biometricKeyHash, biometricEnabled ? 1 : 0]
    );

    return {
      configured: true,
      biometricEnabled: Boolean(biometricEnabled),
      biometricKey,
      vaultToken: issueVaultToken(userId),
    };
  }

  static async unlockVault(userId, pin) {
    const [settings] = await query(
      'SELECT * FROM memory_vault_settings WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (!settings?.pin_hash) {
      throw createServiceError('Safe Vault PIN is not set up yet.', 404, 'VAULT_NOT_CONFIGURED');
    }

    const now = Date.now();
    if (settings.locked_until && Number(settings.locked_until) > now) {
      const waitSeconds = Math.ceil((Number(settings.locked_until) - now) / 1000);
      throw createServiceError(
        `Too many wrong PIN attempts. Try again in ${waitSeconds}s.`,
        429,
        'VAULT_PIN_LOCKED'
      );
    }

    const valid = await bcrypt.compare(pin, settings.pin_hash);
    if (!valid) {
      const attempts = Number(settings.failed_attempts || 0) + 1;
      const shouldLock = attempts >= VAULT_LOCK_MAX_ATTEMPTS;
      await query(
        'UPDATE memory_vault_settings SET failed_attempts = ?, locked_until = ? WHERE user_id = ?',
        [attempts, shouldLock ? now + VAULT_LOCK_COOLDOWN_MS : null, userId]
      );
      const remaining = Math.max(0, VAULT_LOCK_MAX_ATTEMPTS - attempts);
      throw createServiceError(
        shouldLock
          ? 'Too many wrong PIN attempts. Safe Vault locked for 30s.'
          : `Incorrect Vault PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
        401,
        'INVALID_VAULT_PIN'
      );
    }

    await query(
      'UPDATE memory_vault_settings SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?',
      [userId]
    );

    return {
      unlocked: true,
      vaultToken: issueVaultToken(userId),
      biometricEnabled: Boolean(settings.biometric_enabled),
    };
  }

  static async unlockVaultBiometric(userId, biometricKey) {
    if (!biometricKey || typeof biometricKey !== 'string') {
      throw createServiceError('Biometric key is required.', 400, 'MISSING_BIOMETRIC_KEY');
    }
    const [settings] = await query(
      'SELECT * FROM memory_vault_settings WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (!settings?.pin_hash || !settings?.biometric_key_hash) {
      throw createServiceError('Biometric unlock is not configured for Safe Vault.', 404, 'VAULT_NOT_CONFIGURED');
    }
    if (!settings.biometric_enabled) {
      throw createServiceError('Biometric unlock is disabled. Please enter Vault PIN.', 403, 'BIOMETRIC_DISABLED');
    }

    const valid = await bcrypt.compare(biometricKey, settings.biometric_key_hash);
    if (!valid) {
      throw createServiceError('Biometric token mismatch. Unlock using Vault PIN.', 401, 'INVALID_BIOMETRIC_KEY');
    }

    await query(
      'UPDATE memory_vault_settings SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?',
      [userId]
    );

    return {
      unlocked: true,
      vaultToken: issueVaultToken(userId),
      biometricEnabled: true,
    };
  }
}
