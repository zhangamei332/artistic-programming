import { Router } from 'express';
import { generateRouter } from './generate';

export const apiRouter = Router();

apiRouter.use('/generate', generateRouter);

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
