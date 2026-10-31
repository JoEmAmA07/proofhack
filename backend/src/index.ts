import './config/env.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { claimsRouter } from './routes/claims.js';
import { repositoryRouter } from './routes/repository.js';
import { ENV } from './config/env.js';

const app = express();
const PORT = ENV.PORT;
const CLIENT_URL = ENV.CLIENT_URL;

// Middleware
app.use(
  cors({
    origin: [
      CLIENT_URL,
      ...Array.from({ length: 8 }, (_, i) => [
        `http://localhost:${5173 + i}`,
        `http://127.0.0.1:${5173 + i}`,
      ]).flat(),
    ],
    credentials: true,
  })
);
app.use(express.json());

// Request logging middleware for debugging during hackathon development
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Root endpoint info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'ProofStack API',
    description: 'AI-powered project verification platform backend',
    status: 'running',
    healthCheck: '/api/health'
  });
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/repository', repositoryRouter);

// Fallback 404 handler for undefined API routes
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested API endpoint does not exist.'
  });
});

// Central error-handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 ProofStack Backend running at: http://localhost:${PORT}`);
  console.log(`🩺 Health check available at: http://localhost:${PORT}/api/health`);
  console.log(`===============================================`);
});

export default app;

