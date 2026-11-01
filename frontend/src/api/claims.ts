export type ClaimStatus = 'NOT_TESTED' | 'VERIFIED' | 'FAILED' | 'PARTIAL';

export interface Claim {
  id: string;
  title: string;
  originalText: string;
  category: string;
  source: string;
  proposedChecks: string[];
  status: ClaimStatus;
}

export interface ExtractionResult {
  documentName: string;
  documentType: 'markdown' | 'text' | 'pdf' | 'pptx' | 'unknown';
  pageOrSlideCount?: number;
  totalClaims: number;
  explanation?: string;
  claims: Claim[];
}

export interface ExtractClaimsResponse {
  success: boolean;
  data?: ExtractionResult;
  error?: string;
  message?: string;
}

/**
 * Uploads a document to the backend to extract technical feature claims using Gemini AI.
 */
export async function uploadAndExtractClaims(
  file: File
): Promise<{ success: boolean; data?: ExtractionResult; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('document', file);

    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const response = await fetch(`${apiBase}/claims/extract`, {
      method: 'POST',
      body: formData,
    });

    const result: ExtractClaimsResponse = await response.json();

    if (!response.ok || !result.success) {
      const errorMsg =
        result.message ||
        result.error ||
        `Server responded with HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, data: result.data };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Network error communicating with claims API';
    return { success: false, error: errorMsg };
  }
}



export interface DocumentPreview {
  documentName: string;
  documentType: 'markdown' | 'text' | 'pdf' | 'pptx';
  pageOrSlideCount?: number;
  text: string;
  suggestedClaims?: Claim[];
}


export async function uploadAndPreviewDocument(
  file: File
): Promise<{
  success: boolean;
  data?: DocumentPreview;
  error?: string;
}> {
  try {
    const formData = new FormData();
    formData.append('document', file);

    const apiBase = import.meta.env.VITE_API_URL || '/api';

    const response = await fetch(`${apiBase}/claims/preview`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success || !result.data) {
      return {
        success: false,
        error:
          result.message ||
          result.error ||
          `Document preview failed (HTTP ${response.status})`,
      };
    }

    return {
      success: true,
      data: result.data as DocumentPreview,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : 'Unable to preview the uploaded document.',
    };
  }
}

