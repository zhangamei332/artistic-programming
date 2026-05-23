import { Router } from 'express';
import { generateTextController, fixCodeController, imageToCodeController } from '../controllers/generateController';

export const generateRouter = Router();

generateRouter.post('/text', generateTextController);
generateRouter.post('/fix', fixCodeController);
generateRouter.post('/image-to-code', imageToCodeController);
