import { sendError } from '../../utils/apiResponse.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_FORMAT_REGEX = /^\+?[\d\s()-]{8,30}$/;

export const normalizePhone = (phone) => {
  if (typeof phone !== 'string') return '';
  return phone.trim().replace(/[\s()-]+/g, '');
};

export const isValidPhone = (phone) => {
  if (typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!PHONE_FORMAT_REGEX.test(trimmed)) return false;
  const normalized = normalizePhone(trimmed);
  const digits = normalized.replace(/\D/g, '');
  return normalized.length <= 30 && digits.length >= 8 && digits.length <= 15;
};

export const validateRegister = (req, res, next) => {
  const { name, email, phone, password, termsAccepted } = req.body || {};
  const errors = {};

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    errors.name = 'Full name is required and must be between 2 and 100 characters.';
  }

  if (!email || typeof email !== 'string' || email.trim().length > 191 || !EMAIL_REGEX.test(email.trim())) {
    errors.email = 'A valid email address is required (max 191 characters).';
  }

  if (!isValidPhone(phone)) {
    errors.phone = 'A valid phone number is required (8 to 15 digits).';
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.password = 'Password must be at least 6 characters long.';
  }

  if (termsAccepted !== true && termsAccepted !== 'true' && termsAccepted !== 1) {
    errors.termsAccepted = 'You must accept the Terms of Service & Privacy Policy.';
  }

  if (Object.keys(errors).length > 0) {
    return sendError(res, 'Validation failed. Please correct the highlighted fields.', 400, 'VALIDATION_ERROR', errors);
  }

  next();
};

export const validateLogin = (req, res, next) => {
  const { identifier, password } = req.body;
  const errors = {};

  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    errors.identifier = 'Email address or phone number is required.';
  }

  if (!password || typeof password !== 'string') {
    errors.password = 'Password is required.';
  }

  if (Object.keys(errors).length > 0) {
    return sendError(res, 'Missing required credentials.', 400, 'VALIDATION_ERROR', errors);
  }

  next();
};

export const validateRefreshToken = (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return sendError(res, 'Refresh token is required.', 400, 'VALIDATION_ERROR', {
      refreshToken: 'Valid refresh token string must be provided.',
    });
  }

  next();
};

export const validateForgotPassword = (req, res, next) => {
  const { identifier } = req.body;

  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return sendError(res, 'Registered email or phone number is required.', 400, 'VALIDATION_ERROR', {
      identifier: 'Email or phone number must be provided.',
    });
  }

  next();
};

export const validateResetPassword = (req, res, next) => {
  const { token, newPassword } = req.body;
  const errors = {};

  if (!token || typeof token !== 'string') {
    errors.token = 'Reset verification token is required.';
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    errors.newPassword = 'New password must be at least 6 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return sendError(res, 'Password reset validation failed.', 400, 'VALIDATION_ERROR', errors);
  }

  next();
};
