import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import pino from 'pino';
import { config } from './config.js';
import agentRouter from './routes/agent.js';
import kbRouter from './routes/kb.js';
import reminderRouter from './routes/reminders.js';
import gotoConnectRouter from './routes/goto-connect.js';
import reportsRouter from './routes/reports.js';
import segmentsRouter from './routes/segments.js';
import milestonesRouter from './routes/milestones.js';
import alertsRouter from './routes/alerts.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

const logger = pino({ level: config.NODE_ENV === 'production' ? 'info' : 'debug' });
const app = express();

// Middleware
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW * 60 * 1000,
  max: config.RATE_LIMIT_MAX,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// Auth middleware for API routes
app.use('/api', authMiddleware);

// Routes
app.use('/api/agent', agentRouter);
app.use('/api/kb', kbRouter);
app.use('/api/reminders', reminderRouter);
app.use('/api/goto-connect', gotoConnectRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/reports/segments', segmentsRouter);
app.use('/api/advisors/milestones', milestonesRouter);
app.use('/api/reports/alerts', alertsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

const port = config.PORT;
app.listen(port, () => {
  logger.info(`Champion Charlie server running on port ${port}`);
});