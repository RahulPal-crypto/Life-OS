import { MemoriesService } from './memories.service.js';
import {
  validateCreateFolder,
  validateUpdateFolder,
  validateCreateItem,
  validateUpdateItem,
  validateBulkAction,
  validateVaultPin,
  validateOverviewQuery,
} from './memories.validator.js';
import { sendSuccess, sendCreated, sendError } from '../../utils/apiResponse.js';

function getVaultToken(req) {
  const token = req.headers['x-vault-token'];
  return typeof token === 'string' ? token.trim() : '';
}

export class MemoriesController {
  static async getOverview(req, res, next) {
    try {
      const filters = validateOverviewQuery(req.query);
      const data = await MemoriesService.getOverview(req.user.id, filters, getVaultToken(req));
      return sendSuccess(res, 'Memories overview retrieved successfully.', data);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code || 'MEMORIES_ERROR');
      }
      next(error);
    }
  }

  static async createFolder(req, res, next) {
    try {
      const validation = validateCreateFolder(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }
      const folder = await MemoriesService.createFolder(
        req.user.id,
        validation.sanitized,
        getVaultToken(req)
      );
      return sendCreated(res, 'Folder created successfully.', folder);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code);
      }
      next(error);
    }
  }

  static async updateFolder(req, res, next) {
    try {
      const { id } = req.params;
      if (!id) return sendError(res, 'Folder ID is required.', 400, 'MISSING_FOLDER_ID');

      const validation = validateUpdateFolder(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const folder = await MemoriesService.updateFolder(
        req.user.id,
        id,
        validation.sanitized,
        getVaultToken(req)
      );
      return sendSuccess(res, 'Folder updated successfully.', folder);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code);
      }
      next(error);
    }
  }

  static async deleteFolder(req, res, next) {
    try {
      const { id } = req.params;
      if (!id) return sendError(res, 'Folder ID is required.', 400, 'MISSING_FOLDER_ID');

      const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
      const result = await MemoriesService.deleteFolder(
        req.user.id,
        id,
        permanent,
        getVaultToken(req)
      );
      return sendSuccess(res, 'Folder deleted successfully.', result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code);
      }
      next(error);
    }
  }

  static async createItem(req, res, next) {
    try {
      const validation = validateCreateItem(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const created = await MemoriesService.createItem(
        req.user.id,
        validation.sanitized,
        getVaultToken(req)
      );
      return sendCreated(res, 'Memory item saved successfully.', created);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code);
      }
      next(error);
    }
  }

  static async updateItem(req, res, next) {
    try {
      const { id } = req.params;
      if (!id) return sendError(res, 'Item ID is required.', 400, 'MISSING_ITEM_ID');

      const validation = validateUpdateItem(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const updated = await MemoriesService.updateItem(
        req.user.id,
        id,
        validation.sanitized,
        getVaultToken(req)
      );
      return sendSuccess(res, 'Memory item updated successfully.', updated);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code);
      }
      next(error);
    }
  }

  static async bulkAction(req, res, next) {
    try {
      const validation = validateBulkAction(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const result = await MemoriesService.bulkAction(
        req.user.id,
        validation.sanitized,
        getVaultToken(req)
      );
      return sendSuccess(res, 'Bulk memory operation completed.', result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code);
      }
      next(error);
    }
  }

  static async setupVaultPin(req, res, next) {
    try {
      const validation = validateVaultPin(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const result = await MemoriesService.setupVaultPin(req.user.id, validation.sanitized);
      return sendSuccess(res, 'Safe Vault PIN saved successfully.', result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code);
      }
      next(error);
    }
  }

  static async unlockVault(req, res, next) {
    try {
      const validation = validateVaultPin(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Vault PIN must be 4 to 6 digits.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const result = await MemoriesService.unlockVault(req.user.id, validation.sanitized.pin);
      return sendSuccess(res, 'Safe Vault unlocked.', result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code);
      }
      next(error);
    }
  }

  static async unlockVaultBiometric(req, res, next) {
    try {
      const result = await MemoriesService.unlockVaultBiometric(
        req.user.id,
        req.body?.biometricKey
      );
      return sendSuccess(res, 'Safe Vault unlocked with biometric.', result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode, error.code);
      }
      next(error);
    }
  }
}
