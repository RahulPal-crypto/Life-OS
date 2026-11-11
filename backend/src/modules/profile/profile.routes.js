import { Router } from 'express';
import { ProfileController } from './profile.controller.js';
import {
  validateUpdateProfileRequest,
  validateChangePassword,
} from './profile.validator.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// All profile endpoints require an active authenticated session
router.use(authenticate);

// GET /api/v1/profile - Full profile, aggregated activity stats, and active sessions
router.get('/', ProfileController.getOverview);

// PUT /api/v1/profile - Update personal profile & daily targets
router.put('/', validateUpdateProfileRequest, ProfileController.updateProfile);

// PUT /api/v1/profile/password - Change password from authenticated profile settings
router.put('/password', validateChangePassword, ProfileController.changePassword);

// DELETE /api/v1/profile/sessions - Revoke all other active sessions
router.delete('/sessions', ProfileController.revokeOtherSessions);

// DELETE /api/v1/profile/sessions/:sessionId - Revoke one specific session
router.delete('/sessions/:sessionId', ProfileController.revokeSession);

export default router;
