import { Router } from 'express';
import { MyDayController } from './myDay.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// All My Day routes require active authentication
router.use(authenticate);

// 1. Get Day Snapshot & Timeline (e.g. GET /api/v1/my-day?date=2026-11-08)
router.get('/', MyDayController.getSnapshot);

// 2. Get Streak / Past N Days History (e.g. GET /api/v1/my-day/history?days=7)
router.get('/history', MyDayController.getHistory);

// 3. Update Daily Metrics (studyHours, workHours, activeSteps, sleepHours, mood)
router.put('/metrics', MyDayController.updateMetrics);

// 4. Log a New Activity
router.post('/activities', MyDayController.createActivity);

// 5. Update an Existing Activity
router.put('/activities/:id', MyDayController.updateActivity);

// 6. Delete an Activity
router.delete('/activities/:id', MyDayController.deleteActivity);

export default router;
