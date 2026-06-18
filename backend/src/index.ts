import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '50mb' }));

app.use('/api', apiRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Server] running on http://localhost:${PORT}`);
});
