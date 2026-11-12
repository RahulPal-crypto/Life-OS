import { Router } from 'express';
import { getAppVersion } from './app.controller.js';

const router = Router();

router.get('/version', getAppVersion);

export default router;
