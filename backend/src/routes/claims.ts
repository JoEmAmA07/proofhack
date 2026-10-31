import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'node:path';
import { parseDocument, DocumentParseError } from '../services/documentParser.js';
import { geminiService, GeminiServiceError } from '../services/geminiService.js';

export const claimsRouter = Router();

// Configure Multer for in-memory buffer storage (no disk persistence)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
    files: 1,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.md', '.markdown', '.txt', '.pdf', '.pptx'];

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file format "${ext}". Allowed file formats are: .md, .txt, .pdf, and .pptx.`
        )
      );
    }
  },
});

/**
 * POST /api/claims/extract
 * Uploads a document (README, PDF, or PPTX) and extracts verifiable technical claims via Gemini AI.
 */
claimsRouter.post(
  '/extract',
  (req: Request, res: Response, next) => {
    upload.single('document')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'File Too Large',
            message: 'Uploaded file exceeds the maximum allowed size of 10 MB.',
          });
        }
        return res.status(400).json({
          success: false,
          error: 'File Upload Error',
          message: err.message,
        });
      } else if (err instanceof Error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid File',
          message: err.message,
        });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Missing File',
        message: 'No document file was provided. Please upload a .md, .txt, .pdf, or .pptx file.',
      });
    }

    // Check if Gemini is configured before parsing
    if (!geminiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Gemini Configuration Required',
        message:
          'GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY to backend/.env to enable AI claim extraction.',
      });
    }

    try {
      // 1. Parse document text and preserve page/slide markers
      const parsed = await parseDocument(file.buffer, file.originalname);

      // 2. Extract technical claims via Gemini AI (never logging file contents)
      const extractionResult = await geminiService.extractClaims(
        parsed.text,
        file.originalname,
        parsed.documentType,
        parsed.pageOrSlideCount
      );

      return res.status(200).json({
        success: true,
        data: extractionResult,
      });
    } catch (err: unknown) {
      if (err instanceof DocumentParseError) {
        return res.status(400).json({
          success: false,
          error: 'Document Parsing Error',
          message: err.message,
        });
      }

      if (err instanceof GeminiServiceError) {
        return res.status(err.statusCode).json({
          success: false,
          error: 'Extraction Error',
          message: err.message,
        });
      }

      const unexpectedMsg = err instanceof Error ? err.message : 'Internal processing error';
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: unexpectedMsg,
      });
    }
  }
);

