import { Router, Request, Response } from 'express';

export const healthRouter = Router();

/**
 * GET /api/health
 * Simple health-check endpoint to verify backend service status and uptime.
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'ProofStack API is operational',
    timestamp: new Date().toISOString(),
    service: 'proofstack-backend',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
});

