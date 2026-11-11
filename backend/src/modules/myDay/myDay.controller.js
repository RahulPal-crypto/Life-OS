import { MyDayService } from './myDay.service.js';
import {
  validateDateQuery,
  validateHistoryDays,
  validateCreateActivity,
  validateUpdateActivity,
  validateUpdateMetrics,
} from './myDay.validator.js';
import { sendSuccess, sendCreated, sendError } from '../../utils/apiResponse.js';

export class MyDayController {
  /**
   * GET /api/v1/my-day?date=YYYY-MM-DD
   */
  static async getSnapshot(req, res, next) {
    try {
      const dateValidation = validateDateQuery(req.query);
      if (!dateValidation.isValid) {
        return sendError(res, dateValidation.error, 400, 'INVALID_DATE_FORMAT');
      }

      const snapshot = await MyDayService.getDaySnapshot(req.user.id, dateValidation.date);
      return sendSuccess(res, 'My Day snapshot retrieved successfully.', snapshot);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/my-day/activities
   */
  static async createActivity(req, res, next) {
    try {
      const validation = validateCreateActivity(req.body);
      if (!validation.isValid) {
        return sendError(
          res,
          'Validation failed. Please correct input fields.',
          400,
          'VALIDATION_FAILED',
          validation.errors
        );
      }

      const created = await MyDayService.createActivity(req.user.id, validation.sanitized);
      return sendCreated(res, 'Activity logged successfully.', created);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/my-day/activities/:id
   */
  static async updateActivity(req, res, next) {
    try {
      const { id } = req.params;
      if (!id) {
        return sendError(res, 'Activity ID is required.', 400, 'MISSING_ACTIVITY_ID');
      }

      const validation = validateUpdateActivity(req.body);
      if (!validation.isValid) {
        return sendError(
          res,
          'Validation failed for activity update.',
          400,
          'VALIDATION_FAILED',
          validation.errors
        );
      }

      const updated = await MyDayService.updateActivity(req.user.id, id, validation.sanitized);
      return sendSuccess(res, 'Activity updated successfully.', updated);
    } catch (error) {
      if (error.code === 'ACTIVITY_NOT_FOUND') {
        return sendError(res, error.message, 404, error.code);
      }
      next(error);
    }
  }

  /**
   * DELETE /api/v1/my-day/activities/:id
   */
  static async deleteActivity(req, res, next) {
    try {
      const { id } = req.params;
      if (!id) {
        return sendError(res, 'Activity ID is required.', 400, 'MISSING_ACTIVITY_ID');
      }

      await MyDayService.deleteActivity(req.user.id, id);
      return sendSuccess(res, 'Activity deleted successfully.', { id });
    } catch (error) {
      if (error.code === 'ACTIVITY_NOT_FOUND') {
        return sendError(res, error.message, 404, error.code);
      }
      next(error);
    }
  }

  /**
   * PUT /api/v1/my-day/metrics
   */
  static async updateMetrics(req, res, next) {
    try {
      const validation = validateUpdateMetrics(req.body);
      if (!validation.isValid) {
        return sendError(
          res,
          'Validation failed for daily metrics.',
          400,
          'VALIDATION_FAILED',
          validation.errors
        );
      }

      const updated = await MyDayService.updateMetrics(req.user.id, validation.sanitized);
      return sendSuccess(res, 'Daily metrics updated successfully.', updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/my-day/history?days=7
   */
  static async getHistory(req, res, next) {
    try {
      const validation = validateHistoryDays(req.query.days);
      if (!validation.isValid) {
        return sendError(res, validation.error, 400, 'INVALID_DAYS_PARAM');
      }

      const history = await MyDayService.getHistory(req.user.id, validation.days);
      return sendSuccess(res, 'My Day history retrieved successfully.', history);
    } catch (error) {
      next(error);
    }
  }
}
