import { sendError } from '../../utils/apiResponse.js';
import { isValidPhone } from '../auth/auth.validator.js';

const validateNullableText = (value, fieldName, maxLength, errors, sanitized) => {
  if (value === undefined) return;
  if (value === null) {
    sanitized[fieldName] = null;
    return;
  }
  if (typeof value !== 'string') {
    errors[fieldName] = `${fieldName} must be a string or null.`;
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    errors[fieldName] = `${fieldName} cannot exceed ${maxLength} characters.`;
    return;
  }
  sanitized[fieldName] = trimmed.length > 0 ? trimmed : null;
};

const parseBoundedNumber = (value, fieldName, { min, max, integer = false }, errors) => {
  if (value === null || typeof value === 'boolean' || typeof value === 'object') {
    errors[fieldName] = `${fieldName} must be a valid ${integer ? 'integer' : 'number'}.`;
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    errors[fieldName] = `${fieldName} must be a valid ${integer ? 'integer' : 'number'}.`;
    return undefined;
  }
  const num = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(num)) {
    errors[fieldName] = `${fieldName} must be a finite ${integer ? 'integer' : 'number'}.`;
    return undefined;
  }
  if (integer && !Number.isInteger(num)) {
    errors[fieldName] = `${fieldName} must be a whole integer.`;
    return undefined;
  }
  if (num < min || num > max) {
    errors[fieldName] = `${fieldName} must be between ${min} and ${max}.`;
    return undefined;
  }
  return num;
};

/**
 * Shared payload validator for updating profile fields (used by both /profile and /auth/profile).
 */
export const validateProfilePayload = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { isValid: false, errors: null, message: 'Invalid request payload.', sanitized: {} };
  }

  const { name, phone, profileImage, headline, bio, location, dailyFocusGoal, dailyStepsGoal } = body;
  const errors = {};
  const sanitized = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      errors.name = 'Full name must be between 2 and 100 characters.';
    } else {
      sanitized.name = name.trim();
    }
  }

  if (phone !== undefined) {
    if (!isValidPhone(phone)) {
      errors.phone = 'A valid phone number is required (8 to 15 digits).';
    } else {
      sanitized.phone = phone;
    }
  }

  validateNullableText(profileImage, 'profileImage', 500, errors, sanitized);
  validateNullableText(headline, 'headline', 100, errors, sanitized);
  validateNullableText(bio, 'bio', 250, errors, sanitized);
  validateNullableText(location, 'location', 100, errors, sanitized);

  if (dailyFocusGoal !== undefined) {
    const goal = parseBoundedNumber(dailyFocusGoal, 'dailyFocusGoal', { min: 0.5, max: 24 }, errors);
    if (goal !== undefined) {
      sanitized.dailyFocusGoal = Math.round(goal * 10) / 10;
    }
  }

  if (dailyStepsGoal !== undefined) {
    const steps = parseBoundedNumber(dailyStepsGoal, 'dailyStepsGoal', { min: 500, max: 100000, integer: true }, errors);
    if (steps !== undefined) {
      sanitized.dailyStepsGoal = steps;
    }
  }

  if (Object.keys(errors).length === 0 && Object.keys(sanitized).length === 0) {
    return {
      isValid: false,
      errors: null,
      message: 'At least one updatable profile field must be provided.',
      sanitized: {},
    };
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : null,
    message: 'Profile validation failed.',
    sanitized,
  };
};

export const validateUpdateProfileRequest = (req, res, next) => {
  const result = validateProfilePayload(req.body);
  if (!result.isValid) {
    return sendError(res, result.message, 400, 'VALIDATION_ERROR', result.errors);
  }
  req.sanitizedProfile = result.sanitized;
  next();
};

export const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  const errors = {};

  if (!currentPassword || typeof currentPassword !== 'string') {
    errors.currentPassword = 'Current password is required.';
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    errors.newPassword = 'New password must be at least 6 characters long.';
  } else if (currentPassword && newPassword === currentPassword) {
    errors.newPassword = 'New password must be different from your current password.';
  }

  if (Object.keys(errors).length > 0) {
    return sendError(res, 'Password change validation failed.', 400, 'VALIDATION_ERROR', errors);
  }

  next();
};
