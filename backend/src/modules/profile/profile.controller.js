import { ProfileService } from './profile.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class ProfileController {
  static async getOverview(req, res, next) {
    try {
      const overview = await ProfileService.getOverview(req.user.id);
      return sendSuccess(res, 'Profile overview retrieved successfully.', overview);
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const updatedUser = await ProfileService.updateProfile(req.user.id, req.sanitizedProfile);
      return sendSuccess(res, 'Profile updated successfully.', updatedUser);
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const result = await ProfileService.changePassword(req.user.id, req.body);
      return sendSuccess(res, result.message, null);
    } catch (error) {
      next(error);
    }
  }

  static async revokeSession(req, res, next) {
    try {
      const result = await ProfileService.revokeSession(req.user.id, req.params.sessionId);
      return sendSuccess(res, result.message, { sessionId: result.sessionId });
    } catch (error) {
      next(error);
    }
  }

  static async revokeOtherSessions(req, res, next) {
    try {
      const result = await ProfileService.revokeOtherSessions(
        req.user.id,
        req.body?.currentRefreshToken
      );
      return sendSuccess(res, result.message, { revokedCount: result.revokedCount });
    } catch (error) {
      next(error);
    }
  }
}
