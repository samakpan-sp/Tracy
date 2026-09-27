import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health.js';
import protectedRouter from './routes/protected.js';
import investigationsRouter from './routes/investigations.js';
import evidenceUploadRouter from './routes/evidenceUpload.js';
import helmet from 'helmet';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5174'; //port

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());
app.use(helmet());

app.use('/api/health', healthRouter);
app.use('/api/protected-ping', protectedRouter);
app.use('/api/investigations', investigationsRouter);
app.use('/api/evidence-upload', evidenceUploadRouter);


app.listen(PORT, () => {
  console.log(`TRACY backend running on http://localhost:${PORT}`);
});

