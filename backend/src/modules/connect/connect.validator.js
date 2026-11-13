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

export function validateSendMessage(body = {}) {
  const errors = [];
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const messageType = ['text', 'system'].includes(body.messageType) ? body.messageType : 'text';
  const replyToId = typeof body.replyToId === 'string' ? body.replyToId.trim() : null;

  if (!content) {
    errors.push('Message content cannot be empty.');
  } else if (content.length > 5000) {
    errors.push('Message content cannot exceed 5000 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      content,
      messageType,
      replyToId,
    },
  };
}
