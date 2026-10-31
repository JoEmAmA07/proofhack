export interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
  service: string;
  version: string;
  uptimeSeconds: number;
  environment: string;
}

/**
 * Checks backend health using the /api/health endpoint.
 * Works seamlessly with both Vite dev server proxy (/api/health)
 * and direct environment-configured base URLs.
 */
export async function checkBackendHealth(): Promise<{ ok: boolean; data?: HealthResponse; error?: string }> {
  try {
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${apiBase}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Server responded with status ${response.status}`,
      };
    }

    const data: HealthResponse = await response.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unable to connect to backend server';
    return { ok: false, error: errorMsg };
  }
}

