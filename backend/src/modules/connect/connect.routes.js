import { Router } from 'express';
import { ConnectController } from './connect.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Require valid authentication for all Connect endpoints
router.use(authenticate);

// Security & App Lock
router.get('/security/status', ConnectController.getSecurityStatus);
router.post('/security/setup-pin', ConnectController.setupPin);
router.post('/security/verify-pin', ConnectController.verifyPin);

// Contacts & Auto-Discovery
router.post('/contacts/sync', ConnectController.syncContacts);
router.get('/contacts/search', ConnectController.searchUsers);

// Conversations
router.get('/conversations', ConnectController.getConversations);
router.post('/conversations', ConnectController.createConversation);
router.post('/conversations/contact', ConnectController.startContactConversation);

// Messages & Attachments
router.post('/upload', ConnectController.uploadMedia);
router.get('/conversations/:id/messages', ConnectController.getMessages);
router.post('/conversations/:id/messages', ConnectController.sendMessage);
router.post('/conversations/:id/read', ConnectController.markRead);

// Voice & Video Calls (Phase 3)
router.post('/calls/initiate', ConnectController.initiateCall);
router.post('/calls/:id/respond', ConnectController.respondCall);
router.post('/calls/:id/end', ConnectController.endCall);
router.get('/calls/history', ConnectController.getCallHistory);

export default router;
