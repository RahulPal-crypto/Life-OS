import { ConnectService } from './connect.service.js';
import {
  validateSetupPin,
  validateVerifyPin,
  validateSyncContacts,
  validateCreateConversation,
  validateSendMessage,
} from './connect.validator.js';
import { broadcastToUsers, isUserOnline } from './connect.socket.js';
import { sendSuccess, sendCreated, sendError } from '../../utils/apiResponse.js';

export class ConnectController {
  // 1. Security & Lock
  static async getSecurityStatus(req, res, next) {
    try {
      const data = await ConnectService.getSecurityStatus(req.user.id);
      return sendSuccess(res, 'Security status retrieved.', data);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async setupPin(req, res, next) {
    try {
      const validation = validateSetupPin(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const result = await ConnectService.setupSecurityPin(req.user.id, validation.sanitized);
      return sendCreated(res, 'Connect PIN configured successfully.', result);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async verifyPin(req, res, next) {
    try {
      const validation = validateVerifyPin(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const result = await ConnectService.verifySecurityPin(req.user.id, validation.sanitized.pin);
      return sendSuccess(res, 'PIN verified successfully.', result);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // 2. Contacts Sync
  static async syncContacts(req, res, next) {
    try {
      const validation = validateSyncContacts(req.body);
      const result = await ConnectService.syncPhoneContacts(req.user.id, validation.sanitized.contacts);

      // Augment registered users with live online status
      const augmented = {
        registeredUsers: result.registeredUsers.map((u) => ({
          ...u,
          isOnline: isUserOnline(u.id),
        })),
        otherContacts: result.otherContacts,
      };

      return sendSuccess(res, 'Contacts synced successfully.', augmented);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async searchUsers(req, res, next) {
    try {
      const query = String(req.query.q || '').trim();
      const results = await ConnectService.searchUsers(req.user.id, query);
      const augmented = results.map((u) => ({
        ...u,
        isOnline: isUserOnline(u.id),
      }));
      return sendSuccess(res, 'User search results.', augmented);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // 3. Conversations
  static async getConversations(req, res, next) {
    try {
      const filter = String(req.query.filter || 'all');
      const list = await ConnectService.listConversations(req.user.id, filter);

      // Add online status indicator for direct chat partners
      const augmented = list.map((c) => ({
        ...c,
        isOnline: c.partnerUserId ? isUserOnline(c.partnerUserId) : false,
      }));

      return sendSuccess(res, 'Conversations retrieved.', augmented);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async createConversation(req, res, next) {
    try {
      const validation = validateCreateConversation(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const { type, targetUserId, name, icon, memberIds } = validation.sanitized;
      let conv;

      if (type === 'direct') {
        conv = await ConnectService.getOrCreateDirectConversation(req.user.id, targetUserId);
      } else {
        conv = await ConnectService.createGroupConversation(req.user.id, {
          name,
          icon,
          memberIds,
        });
      }

      return sendCreated(res, 'Conversation ready.', conv);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // 4. Messages
  static async getMessages(req, res, next) {
    try {
      const { id: conversationId } = req.params;
      const { limit, beforeId } = req.query;

      const messages = await ConnectService.getMessages(req.user.id, conversationId, {
        limit,
        beforeId,
      });

      return sendSuccess(res, 'Messages loaded.', messages);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async sendMessage(req, res, next) {
    try {
      const { id: conversationId } = req.params;
      const validation = validateSendMessage(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed.', 400, 'VALIDATION_FAILED', validation.errors);
      }

      const result = await ConnectService.sendMessage(req.user.id, conversationId, validation.sanitized);

      // Broadcast to other members via WebSocket
      broadcastToUsers(result.recipientUserIds, 'new_message', {
        ...result.message,
        isOutgoing: false,
      });

      return sendCreated(res, 'Message sent.', result.message);
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async markRead(req, res, next) {
    try {
      const { id: conversationId } = req.params;
      const result = await ConnectService.markConversationRead(req.user.id, conversationId);

      // Broadcast read receipt to recipients
      broadcastToUsers(result.recipientUserIds, 'messages_read', {
        conversationId,
        readByUserId: req.user.id,
      });

      return sendSuccess(res, 'Conversation marked as read.', { conversationId });
    } catch (err) {
      if (err.statusCode) {
        return sendError(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }
}
