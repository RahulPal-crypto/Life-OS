import { Router } from 'express';
import * as authController from './auth.controller.js';
import {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateForgotPassword,
  validateResetPassword,
} from './auth.validator.js';
import { validateUpdateProfileRequest } from '../profile/profile.validator.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authRateLimiter, strictLoginLimiter } from '../../middlewares/rateLimiter.js';

const router = Router();

// Public Authentication Endpoints
router.post('/register', authRateLimiter, validateRegister, authController.register);
router.post('/login', strictLoginLimiter, validateLogin, authController.login);
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);
router.post('/logout', authController.logout);

// Password Recovery Endpoints
router.post('/forgot-password', authRateLimiter, validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, validateResetPassword, authController.resetPassword);

// Protected User Profile & Session Endpoints
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, validateUpdateProfileRequest, authController.updateProfile);
router.get('/sessions', authenticate, authController.getSessions);
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);

export default router;
