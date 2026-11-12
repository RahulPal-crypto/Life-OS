import { Router } from 'express';
import { MemoriesController } from './memories.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);

// File manager + stories overview
router.get('/', MemoriesController.getOverview);

// Folders CRUD
router.post('/folders', MemoriesController.createFolder);
router.put('/folders/:id', MemoriesController.updateFolder);
router.delete('/folders/:id', MemoriesController.deleteFolder);

// Memory items CRUD & bulk file actions
router.post('/items', MemoriesController.createItem);
router.put('/items/:id', MemoriesController.updateItem);
router.post('/items/bulk', MemoriesController.bulkAction);

// Safe Vault security
router.post('/vault/setup', MemoriesController.setupVaultPin);
router.post('/vault/unlock', MemoriesController.unlockVault);
router.post('/vault/unlock-biometric', MemoriesController.unlockVaultBiometric);

export default router;
