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

