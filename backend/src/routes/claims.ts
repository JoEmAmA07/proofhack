import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'node:path';
import { parseDocument, DocumentParseError } from '../services/documentParser.js';
import { suggestClaimsFromText } from '../services/claimSuggestionService.js';
import { geminiService } from '../services/geminiService.js';
import { discoverRepositoryClaims } from '../services/githubDocumentationService.js';

export const claimsRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.md', '.markdown', '.txt', '.pdf', '.pptx'].includes(ext)) cb(null, true);
    else cb(new Error(`Invalid file format "${ext}". Allowed: .md, .markdown, .txt, .pdf, .pptx.`));
  },
});
const documentUpload = (req: Request, res: Response, next: (err?: unknown) => void) => {
  upload.single('document')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: 'File Upload Error', message: err.code === 'LIMIT_FILE_SIZE' ? 'Maximum file size is 10 MB.' : err.message });
    }
    if (err instanceof Error) return res.status(400).json({ success: false, error: 'Invalid File', message: err.message });
    next();
  });
};

claimsRouter.post('/extract', documentUpload, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Missing File', message: 'Please upload a document.' });
  try {
    const parsed = await parseDocument(req.file.buffer, req.file.originalname);
    const offline = suggestClaimsFromText(parsed.text);
    let aiError: string | undefined;
    if (geminiService.isConfigured()) {
      try {
        const ai = await geminiService.extractClaims(parsed.text, req.file.originalname, parsed.documentType, parsed.pageOrSlideCount);
        if (ai.claims.length) return res.status(200).json({ success: true, data: ai });
        aiError = 'Gemini returned no claims.';
      } catch (error: unknown) {
        aiError = error instanceof Error ? error.message : 'Gemini unavailable.';
      }
    } else {
      aiError = 'Gemini is not configured.';
    }
    return res.status(200).json({
      success: true,
      data: {
        documentName: req.file.originalname,
        documentType: parsed.documentType,
        pageOrSlideCount: parsed.pageOrSlideCount,
        totalClaims: offline.length,
        claims: offline,
        explanation: offline.length
          ? 'Offline claim suggestions (manual review required). AI extraction unavailable or empty.'
          : 'No confident technical claims found. Add a manual claim or try documentation with explicit feature descriptions.',
      },
      extractionMode: 'offline',
      ...(aiError ? { extractionNote: aiError } : {}),
    });
  } catch (err: unknown) {
    const parseError = err instanceof DocumentParseError;
    return res.status(parseError ? 400 : 500).json({ success: false, error: parseError ? 'Document Parsing Error' : 'Internal Server Error', message: err instanceof Error ? err.message : 'Unable to extract document claims.' });
  }
});

claimsRouter.post('/preview', documentUpload, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'Missing File', message: 'Please upload a document.' });
  try {
    const parsed = await parseDocument(req.file.buffer, req.file.originalname);
    return res.status(200).json({
      success: true, data: {
        documentName: req.file.originalname,
        documentType: parsed.documentType,
        pageOrSlideCount: parsed.pageOrSlideCount,
        text: parsed.text,
        suggestedClaims: suggestClaimsFromText(parsed.text),
      }
    });
  } catch (err: unknown) {
    const parseError = err instanceof DocumentParseError;
    return res.status(parseError ? 400 : 500).json({ success: false, error: 'Document Preview Error', message: err instanceof Error ? err.message : 'Unable to preview document.' });
  }
});

claimsRouter.post('/discover-repository', async (req: Request, res: Response) => {
  const repoUrl = req.body?.repoUrl;
  if (typeof repoUrl !== 'string' || !repoUrl.trim()) return res.status(400).json({ success: false, message: 'A public GitHub repository URL is required.' });
  try {
    const result = await discoverRepositoryClaims(repoUrl);
    return res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Unable to discover repository documentation.' });
  }
});
