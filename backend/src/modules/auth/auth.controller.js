import { authService } from './auth.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

const getClientMeta = (req) => {
  return {
    deviceName: req.body.deviceName || req.headers['x-device-name'] || 'Android Device',
    ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
    userAgent: req.headers['user-agent'] || 'LifeOS-Mobile',
  };
};

export const register = async (req, res, next) => {
  try {
    const meta = getClientMeta(req);
    const result = await authService.register(req.body, meta);
    return sendSuccess(res, 'User registered successfully. Welcome to LIFE OS!', result, 201);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const meta = getClientMeta(req);
    const result = await authService.login(req.body, meta);
    return sendSuccess(res, 'Signed in successfully. Welcome back!', result, 200);
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const meta = getClientMeta(req);
    const result = await authService.refreshToken(req.body.refreshToken, meta);
    return sendSuccess(res, 'Tokens refreshed successfully.', result, 200);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken;
    await authService.logout(refreshToken);
    return sendSuccess(res, 'Logged out successfully from this session.', null, 200);
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.identifier);
    return sendSuccess(res, result.message, result, 200);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword);
    return sendSuccess(res, result.message, null, 200);
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    return sendSuccess(res, 'Profile retrieved successfully.', profile, 200);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const updated = await authService.updateProfile(req.user.id, req.sanitizedProfile || req.body);
    return sendSuccess(res, 'Profile updated successfully.', updated, 200);
  } catch (error) {
    next(error);
  }
};

export const getSessions = async (req, res, next) => {
  try {
    const sessions = await authService.getSessions(req.user.id);
    return sendSuccess(res, 'Active device sessions retrieved.', sessions, 200);
  } catch (error) {
    next(error);
  }
};

export const revokeSession = async (req, res, next) => {
  try {
    const result = await authService.revokeSession(req.user.id, req.params.sessionId);
    return sendSuccess(res, result.message, null, 200);
  } catch (error) {
    next(error);
  }
};
