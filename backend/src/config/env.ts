import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Determine the directory containing this config file in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Robustly load environment variables from .env files.
 * Checks both backend/.env (relative to codebase) and process.cwd()/.env
 * so environment variables are loaded regardless of the execution working directory.
 */
function loadEnvironment(): void {
  const candidatePaths: string[] = [
    // 1. backend/.env relative to this source file (backend/src/config -> backend/.env)
    path.resolve(__dirname, '../../.env'),
    // 2. backend/.env relative to current working directory (e.g. monorepo root D:\proofhackathon\backend\.env)
    path.resolve(process.cwd(), 'backend', '.env'),
    // 3. .env in current working directory
    path.resolve(process.cwd(), '.env'),
    // 4. monorepo root .env relative to this source file (backend/src/config -> ../../../.env)
    path.resolve(__dirname, '../../../.env'),
  ];

  let loaded = false;
  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      loaded = true;
    }
  }

  // Fallback default dotenv invocation
  if (!loaded) {
    dotenv.config();
  }
}

// Immediately load environment upon module evaluation
loadEnvironment();

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
  get GEMINI_API_KEY(): string | undefined {
    return process.env.GEMINI_API_KEY?.trim();
  },
  get GEMINI_MODEL(): string {
    return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  },
  get isGeminiConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  },
};

