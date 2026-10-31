import { Router, Request, Response } from 'express';
import { repositoryService } from '../services/repositoryService.js';
import { GitHubUrlError } from '../services/githubUrlValidator.js';
import { GitHubApiError } from '../services/githubClient.js';
import { Claim } from '../types/claims.js';

export const repositoryRouter = Router();

/**
 * POST /api/repository/analyze
 * Analyzes a public GitHub repository: fetches metadata, file tree, dependencies, and key files.
 */
repositoryRouter.post('/analyze', async (req: Request, res: Response) => {
  const { repoUrl } = req.body;

  if (!repoUrl || typeof repoUrl !== 'string' || repoUrl.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing Repository URL',
      message: 'Please provide a valid public GitHub repository URL in "repoUrl" (e.g. https://github.com/owner/repo).',
    });
  }

  try {
    const { analysis } = await repositoryService.analyzeRepository(repoUrl);
    return res.status(200).json({
      success: true,
      data: analysis,
    });
  } catch (err: unknown) {
    if (err instanceof GitHubUrlError) {
      return res.status(err.statusCode).json({
        success: false,
        error: 'Invalid GitHub URL',
        message: err.message,
      });
    }

    if (err instanceof GitHubApiError) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.isRateLimit ? 'GitHub Rate Limit' : 'GitHub API Error',
        message: err.message,
        rateLimitResetDate: err.rateLimitResetDate,
      });
    }

    const unexpectedMsg = err instanceof Error ? err.message : 'Unknown repository analysis error';
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: unexpectedMsg,
    });
  }
});

/**
 * POST /api/repository/match-claims
 * Matches an array of technical claims against the analyzed repository code and manifests.
 */
repositoryRouter.post('/match-claims', async (req: Request, res: Response) => {
  const { repoUrl, claims } = req.body;

  if (!repoUrl || typeof repoUrl !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing Repository URL',
      message: 'Please provide a valid GitHub repository URL in "repoUrl".',
    });
  }

  if (!Array.isArray(claims) || claims.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing Claims',
      message: 'Please provide an array of claims to evaluate against the repository.',
    });
  }

  try {
    const result = await repositoryService.matchClaims(repoUrl, claims as Claim[]);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    if (err instanceof GitHubUrlError) {
      return res.status(err.statusCode).json({
        success: false,
        error: 'Invalid GitHub URL',
        message: err.message,
      });
    }

    if (err instanceof GitHubApiError) {
      return res.status(err.statusCode).json({
        success: false,
        error: err.isRateLimit ? 'GitHub Rate Limit' : 'GitHub API Error',
        message: err.message,
      });
    }

    const unexpectedMsg = err instanceof Error ? err.message : 'Unknown claim matching error';
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: unexpectedMsg,
    });
  }
});
