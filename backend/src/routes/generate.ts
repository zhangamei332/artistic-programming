import { Router } from 'express';
import { generateTextController, fixCodeController } from '../controllers/generateController';

export const generateRouter = Router();

generateRouter.post('/text', generateTextController);
generateRouter.post('/fix', fixCodeController);
