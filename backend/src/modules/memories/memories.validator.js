const VALID_MEDIA_TYPES = ['photo', 'video', 'document', 'audio', 'other'];
const VALID_BULK_ACTIONS = [
  'move',
  'copy',
  'trash',
  'restore',
  'delete-forever',
  'move-to-vault',
  'remove-from-vault',
  'favorite',
  'unfavorite',
];
const VALID_SORTS = ['newest', 'oldest', 'name_asc', 'size_desc', 'type'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function cleanOptionalText(val, fieldName, maxLength, errors) {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (typeof val !== 'string') {
    errors[fieldName] = `${fieldName} must be a string.`;
    return undefined;
  }
  const trimmed = val.trim();
  if (trimmed.length > maxLength) {
    errors[fieldName] = `${fieldName} cannot exceed ${maxLength} characters.`;
    return undefined;
  }
  return trimmed === '' ? null : trimmed;
}

function getTodayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const validateCreateFolder = (body) => {
  const errors = {};
  const payload = body && typeof body === 'object' ? body : {};
  const { name, parentId, color, icon, isPinned, isVault } = payload;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.name = 'Folder name is required.';
  } else if (name.trim().length > 100) {
    errors.name = 'Folder name cannot exceed 100 characters.';
  }

  const cleanParentId = cleanOptionalText(parentId, 'parentId', 36, errors);
  const cleanColor = cleanOptionalText(color, 'color', 20, errors) || '#7C3AED';
  const cleanIcon = cleanOptionalText(icon, 'icon', 16, errors) || '📁';

  const hasErrors = Object.keys(errors).length > 0;
  return {
    isValid: !hasErrors,
    errors: hasErrors ? errors : null,
    sanitized: {
      name: typeof name === 'string' ? name.trim() : '',
      parentId: cleanParentId ?? null,
      color: cleanColor,
      icon: cleanIcon,
      isPinned: Boolean(isPinned),
      isVault: Boolean(isVault),
    },
  };
};

export const validateUpdateFolder = (body) => {
  const errors = {};
  const sanitized = {};
  const payload = body && typeof body === 'object' ? body : {};

  if (payload.name !== undefined) {
    if (typeof payload.name !== 'string' || payload.name.trim().length === 0) {
      errors.name = 'Folder name cannot be empty.';
    } else if (payload.name.trim().length > 100) {
      errors.name = 'Folder name cannot exceed 100 characters.';
    } else {
      sanitized.name = payload.name.trim();
    }
  }

  if (payload.parentId !== undefined) {
    sanitized.parentId = cleanOptionalText(payload.parentId, 'parentId', 36, errors);
  }
  if (payload.color !== undefined) {
    sanitized.color = cleanOptionalText(payload.color, 'color', 20, errors) || '#7C3AED';
  }
  if (payload.icon !== undefined) {
    sanitized.icon = cleanOptionalText(payload.icon, 'icon', 16, errors) || '📁';
  }
  if (payload.isPinned !== undefined) {
    sanitized.isPinned = Boolean(payload.isPinned);
  }
  if (payload.isVault !== undefined) {
    sanitized.isVault = Boolean(payload.isVault);
  }
  if (payload.isTrashed !== undefined) {
    sanitized.isTrashed = Boolean(payload.isTrashed);
  }

  const hasErrors = Object.keys(errors).length > 0;
  return { isValid: !hasErrors, errors: hasErrors ? errors : null, sanitized };
};

export const validateCreateItem = (body) => {
  const errors = {};
  const payload = body && typeof body === 'object' ? body : {};

  const titleRaw = typeof payload.title === 'string' ? payload.title.trim() : '';
  const fileNameRaw = typeof payload.fileName === 'string' ? payload.fileName.trim() : '';
  const finalTitle = titleRaw || fileNameRaw;
  const finalFileName = fileNameRaw || titleRaw || 'memory_file';

  if (!finalTitle) {
    errors.title = 'Title or fileName is required.';
  } else if (finalTitle.length > 180) {
    errors.title = 'Title cannot exceed 180 characters.';
  }

  if (finalFileName.length > 255) {
    errors.fileName = 'File name cannot exceed 255 characters.';
  }

  const cleanMediaType =
    typeof payload.mediaType === 'string'
      ? payload.mediaType.trim().toLowerCase()
      : 'document';
  if (!VALID_MEDIA_TYPES.includes(cleanMediaType)) {
    errors.mediaType = `mediaType must be one of: ${VALID_MEDIA_TYPES.join(', ')}.`;
  }

  let cleanSize = 0;
  if (payload.sizeBytes !== undefined && payload.sizeBytes !== null) {
    const parsedSize = Number(payload.sizeBytes);
    if (!Number.isFinite(parsedSize) || parsedSize < 0) {
      errors.sizeBytes = 'sizeBytes must be a non-negative number.';
    } else {
      cleanSize = Math.floor(parsedSize);
    }
  }

  let cleanMemoryDate = getTodayDateString();
  if (payload.memoryDate !== undefined && payload.memoryDate !== null && payload.memoryDate !== '') {
    if (typeof payload.memoryDate !== 'string' || !DATE_REGEX.test(payload.memoryDate.trim())) {
      errors.memoryDate = 'memoryDate must be formatted as YYYY-MM-DD.';
    } else {
      cleanMemoryDate = payload.memoryDate.trim();
    }
  }

  const folderId = cleanOptionalText(payload.folderId, 'folderId', 36, errors) ?? null;
  const mimeType = cleanOptionalText(payload.mimeType, 'mimeType', 120, errors) ?? null;
  const localUri = cleanOptionalText(payload.localUri, 'localUri', 2000, errors) ?? null;
  const vaultUri = cleanOptionalText(payload.vaultUri, 'vaultUri', 2000, errors) ?? null;
  const driveFileId = cleanOptionalText(payload.driveFileId, 'driveFileId', 180, errors) ?? null;
  const story = cleanOptionalText(payload.story, 'story', 4000, errors) ?? null;
  const location = cleanOptionalText(payload.location, 'location', 150, errors) ?? null;
  const people = cleanOptionalText(payload.people, 'people', 255, errors) ?? null;
  const tags = cleanOptionalText(payload.tags, 'tags', 255, errors) ?? null;
  const mood = cleanOptionalText(payload.mood, 'mood', 40, errors) ?? null;
  const linkedActivityId =
    cleanOptionalText(payload.linkedActivityId, 'linkedActivityId', 36, errors) ?? null;

  const hasErrors = Object.keys(errors).length > 0;
  return {
    isValid: !hasErrors,
    errors: hasErrors ? errors : null,
    sanitized: {
      folderId,
      title: finalTitle,
      fileName: finalFileName,
      mediaType: cleanMediaType,
      mimeType,
      sizeBytes: cleanSize,
      localUri,
      vaultUri,
      driveFileId,
      driveSynced: Boolean(payload.driveSynced),
      story,
      memoryDate: cleanMemoryDate,
      location,
      people,
      tags,
      mood,
      isFavorite: Boolean(payload.isFavorite),
      isVault: Boolean(payload.isVault),
      linkedActivityId,
    },
  };
};

export const validateUpdateItem = (body) => {
  const errors = {};
  const sanitized = {};
  const payload = body && typeof body === 'object' ? body : {};

  if (payload.title !== undefined) {
    if (typeof payload.title !== 'string' || payload.title.trim().length === 0) {
      errors.title = 'Title cannot be empty.';
    } else if (payload.title.trim().length > 180) {
      errors.title = 'Title cannot exceed 180 characters.';
    } else {
      sanitized.title = payload.title.trim();
    }
  }
  if (payload.fileName !== undefined) {
    if (typeof payload.fileName !== 'string' || payload.fileName.trim().length === 0) {
      errors.fileName = 'fileName cannot be empty.';
    } else if (payload.fileName.trim().length > 255) {
      errors.fileName = 'fileName cannot exceed 255 characters.';
    } else {
      sanitized.fileName = payload.fileName.trim();
    }
  }
  if (payload.folderId !== undefined) {
    sanitized.folderId = cleanOptionalText(payload.folderId, 'folderId', 36, errors);
  }
  if (payload.story !== undefined) {
    sanitized.story = cleanOptionalText(payload.story, 'story', 4000, errors);
  }
  if (payload.location !== undefined) {
    sanitized.location = cleanOptionalText(payload.location, 'location', 150, errors);
  }
  if (payload.people !== undefined) {
    sanitized.people = cleanOptionalText(payload.people, 'people', 255, errors);
  }
  if (payload.tags !== undefined) {
    sanitized.tags = cleanOptionalText(payload.tags, 'tags', 255, errors);
  }
  if (payload.mood !== undefined) {
    sanitized.mood = cleanOptionalText(payload.mood, 'mood', 40, errors);
  }
  if (payload.localUri !== undefined) {
    sanitized.localUri = cleanOptionalText(payload.localUri, 'localUri', 2000, errors);
  }
  if (payload.vaultUri !== undefined) {
    sanitized.vaultUri = cleanOptionalText(payload.vaultUri, 'vaultUri', 2000, errors);
  }
  if (payload.driveFileId !== undefined) {
    sanitized.driveFileId = cleanOptionalText(payload.driveFileId, 'driveFileId', 180, errors);
  }
  if (payload.memoryDate !== undefined) {
    if (typeof payload.memoryDate !== 'string' || !DATE_REGEX.test(payload.memoryDate.trim())) {
      errors.memoryDate = 'memoryDate must be YYYY-MM-DD.';
    } else {
      sanitized.memoryDate = payload.memoryDate.trim();
    }
  }
  if (payload.driveSynced !== undefined) sanitized.driveSynced = Boolean(payload.driveSynced);
  if (payload.isFavorite !== undefined) sanitized.isFavorite = Boolean(payload.isFavorite);
  if (payload.isVault !== undefined) sanitized.isVault = Boolean(payload.isVault);
  if (payload.isTrashed !== undefined) sanitized.isTrashed = Boolean(payload.isTrashed);

  const hasErrors = Object.keys(errors).length > 0;
  return { isValid: !hasErrors, errors: hasErrors ? errors : null, sanitized };
};

export const validateBulkAction = (body) => {
  const errors = {};
  const payload = body && typeof body === 'object' ? body : {};
  const { action, itemIds, targetFolderId } = payload;

  if (!VALID_BULK_ACTIONS.includes(action)) {
    errors.action = `action must be one of: ${VALID_BULK_ACTIONS.join(', ')}.`;
  }
  if (!Array.isArray(itemIds) || itemIds.length === 0 || itemIds.length > 200) {
    errors.itemIds = 'itemIds must be a non-empty array of up to 200 IDs.';
  } else if (itemIds.some((id) => typeof id !== 'string' || !id.trim())) {
    errors.itemIds = 'Every itemId must be a valid string.';
  }

  const cleanTargetFolderId =
    cleanOptionalText(targetFolderId, 'targetFolderId', 36, errors) ?? null;

  const hasErrors = Object.keys(errors).length > 0;
  return {
    isValid: !hasErrors,
    errors: hasErrors ? errors : null,
    sanitized: {
      action,
      itemIds: Array.isArray(itemIds) ? itemIds.map((id) => String(id).trim()) : [],
      targetFolderId: cleanTargetFolderId,
    },
  };
};

export const validateVaultPin = (body) => {
  const errors = {};
  const payload = body && typeof body === 'object' ? body : {};
  const pin = typeof payload.pin === 'string' ? payload.pin.trim() : '';

  if (!/^\d{4,6}$/.test(pin)) {
    errors.pin = 'Vault PIN must be 4 to 6 numeric digits.';
  }

  if (payload.currentPin !== undefined && payload.currentPin !== null) {
    const cur = String(payload.currentPin).trim();
    if (!/^\d{4,6}$/.test(cur)) {
      errors.currentPin = 'currentPin must be 4 to 6 numeric digits.';
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  return {
    isValid: !hasErrors,
    errors: hasErrors ? errors : null,
    sanitized: {
      pin,
      currentPin: payload.currentPin ? String(payload.currentPin).trim() : undefined,
      biometricEnabled:
        payload.biometricEnabled !== undefined ? Boolean(payload.biometricEnabled) : true,
    },
  };
};

export const validateOverviewQuery = (query) => {
  const q = query || {};
  const sort = VALID_SORTS.includes(q.sort) ? q.sort : 'newest';
  const category = VALID_MEDIA_TYPES.includes(q.category) ? q.category : null;
  const vault = q.vault === '1' || q.vault === 'true';
  const trashed = q.trashed === '1' || q.trashed === 'true';
  const favoritesOnly = q.favorites === '1' || q.favorites === 'true';
  const largeOnly = q.largeOnly === '1' || q.largeOnly === 'true';
  const unsortedOnly = q.unsortedOnly === '1' || q.unsortedOnly === 'true';
  const folderId = typeof q.folderId === 'string' && q.folderId.trim() ? q.folderId.trim() : null;
  const search = typeof q.search === 'string' && q.search.trim() ? q.search.trim() : null;

  return {
    sort,
    category,
    vault,
    trashed,
    favoritesOnly,
    largeOnly,
    unsortedOnly,
    folderId,
    search,
  };
};
