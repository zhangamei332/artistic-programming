import { Router } from 'express';
import { generateRouter } from './generate';
import { previewRouter } from './preview';

export const apiRouter = Router();

apiRouter.use('/generate', generateRouter);
apiRouter.use('/preview', previewRouter);

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
