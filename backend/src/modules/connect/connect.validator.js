/**
 * Validation rules for My Connect module
 */

export function validateSetupPin(body = {}) {
  const errors = [];
  const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

  if (!pin) {
    errors.push('PIN is required.');
  } else if (!/^\d{4,6}$/.test(pin)) {
    errors.push('PIN must be 4 to 6 numeric digits.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      pin,
      biometricEnabled: Boolean(body.biometricEnabled),
      autoLockDelay: ['immediate', '1m', '5m', 'never'].includes(body.autoLockDelay)
        ? body.autoLockDelay
        : 'immediate',
    },
  };
}

export function validateVerifyPin(body = {}) {
  const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
  const isValid = /^\d{4,6}$/.test(pin);
  return {
    isValid,
    errors: isValid ? [] : ['Enter a valid 4 to 6 digit PIN.'],
    sanitized: { pin },
  };
}

export function validateSyncContacts(body = {}) {
  const contacts = Array.isArray(body.contacts) ? body.contacts : [];
  const sanitizedContacts = contacts
    .map((c) => ({
      name: typeof c?.name === 'string' ? c.name.trim().slice(0, 100) : '',
      phone: typeof c?.phone === 'string' ? c.phone.trim().replace(/[\s\-\(\)]/g, '').slice(0, 30) : '',
    }))
    .filter((c) => Boolean(c.phone));

  return {
    isValid: true,
    errors: [],
    sanitized: { contacts: sanitizedContacts },
  };
}

export function validateCreateConversation(body = {}) {
  const errors = [];
  const type = body.type === 'group' ? 'group' : 'direct';
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : null;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null;
  const icon = typeof body.icon === 'string' ? body.icon.trim().slice(0, 500) : null;
  const memberIds = Array.isArray(body.memberIds)
    ? body.memberIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (type === 'direct' && !targetUserId) {
    errors.push('Target user ID is required for a 1-to-1 conversation.');
  }

  if (type === 'group' && !name) {
    errors.push('Group name is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      type,
      targetUserId,
      name,
      icon,
      memberIds,
    },
  };
}

export const ALLOWED_MESSAGE_TYPES = ['text', 'image', 'video', 'document', 'audio', 'system'];

export function validateSendMessage(body = {}) {
  const errors = [];
  const rawType = typeof body.messageType === 'string' ? body.messageType.toLowerCase() : 'text';
  const messageType = ALLOWED_MESSAGE_TYPES.includes(rawType) ? rawType : 'text';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const mediaUrl = typeof body.mediaUrl === 'string' && body.mediaUrl.trim() ? body.mediaUrl.trim() : null;
  const fileName = typeof body.fileName === 'string' && body.fileName.trim() ? body.fileName.trim() : null;
  const fileSize = typeof body.fileSize === 'number' && Number.isFinite(body.fileSize) ? Math.max(0, Math.round(body.fileSize)) : null;
  const mimeType = typeof body.mimeType === 'string' && body.mimeType.trim() ? body.mimeType.trim() : null;
  const mediaDuration = typeof body.mediaDuration === 'number' && Number.isFinite(body.mediaDuration)
    ? Math.max(0, Math.round(body.mediaDuration))
    : (typeof body.duration === 'number' && Number.isFinite(body.duration) ? Math.max(0, Math.round(body.duration)) : null);
  const thumbnailUrl = typeof body.thumbnailUrl === 'string' && body.thumbnailUrl.trim() ? body.thumbnailUrl.trim() : null;
  const replyToId = typeof body.replyToId === 'string' && body.replyToId.trim() ? body.replyToId.trim() : null;

  if (messageType === 'text' && !content) {
    errors.push('Message content cannot be empty.');
  } else if (!content && !mediaUrl) {
    errors.push('Either message content or media attachment is required.');
  }

  if (content && content.length > 5000) {
    errors.push('Message content cannot exceed 5000 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      content,
      messageType,
      mediaUrl,
      fileName,
      fileSize,
      mimeType,
      mediaDuration,
      thumbnailUrl,
      replyToId,
    },
  };
}

export function validateUploadMedia(body = {}) {
  const errors = [];
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
  const base64Data = typeof body.base64Data === 'string' ? body.base64Data.trim() : '';
  const rawMediaType = typeof body.mediaType === 'string' ? body.mediaType.toLowerCase() : 'image';
  const mediaType = ['image', 'photo', 'video', 'document', 'audio'].includes(rawMediaType)
    ? (rawMediaType === 'photo' ? 'image' : rawMediaType)
    : 'document';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim() : 'application/octet-stream';
  const duration = typeof body.duration === 'number' && Number.isFinite(body.duration) ? Math.max(0, Math.round(body.duration)) : null;

  if (!fileName) {
    errors.push('File name is required.');
  }
  if (!base64Data) {
    errors.push('Base64 file data is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      fileName,
      base64Data,
      mediaType,
      mimeType,
      duration,
    },
  };
}
