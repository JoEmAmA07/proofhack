import path from 'node:path';
import AdmZip from 'adm-zip';
import { PDFParse } from 'pdf-parse';

export interface ParsedDocument {
  text: string;
  documentType: 'markdown' | 'text' | 'pdf' | 'pptx';
  pageOrSlideCount?: number;
}

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentParseError';
  }
}

/**
 * Extracts raw textual content from uploaded file buffers.
 * Supported file formats:
 * - Markdown (.md, .markdown)
 * - Plain Text (.txt)
 * - Portable Document Format (.pdf) - preserves page boundaries
 * - PowerPoint Presentation (.pptx) - preserves slide numbers
 */
export async function parseDocument(
  fileBuffer: Buffer,
  originalFilename: string
): Promise<ParsedDocument> {
  const ext = path.extname(originalFilename).toLowerCase();

  if (ext === '.md' || ext === '.markdown') {
    return parseMarkdownOrText(fileBuffer, 'markdown');
  }

  if (ext === '.txt') {
    return parseMarkdownOrText(fileBuffer, 'text');
  }

  if (ext === '.pdf') {
    return await parsePdf(fileBuffer);
  }

  if (ext === '.pptx') {
    return parsePptx(fileBuffer);
  }

  throw new DocumentParseError(
    `Unsupported document format: "${ext}". Supported formats are .md, .txt, .pdf, and .pptx.`
  );
}

/**
 * Parses Markdown or Plain Text file buffers with UTF-8 decoding.
 */
function parseMarkdownOrText(
  buffer: Buffer,
  docType: 'markdown' | 'text'
): ParsedDocument {
  const content = buffer.toString('utf-8').trim();

  if (!content) {
    throw new DocumentParseError('The uploaded text document is empty.');
  }

  return {
    text: content,
    documentType: docType,
  };
}

/**
 * Parses PDF documents using PDFParse, preserving page numbers where available.
 */
async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    if (!result || !result.text || result.text.trim().length === 0) {
      throw new DocumentParseError(
        'No readable text could be extracted from this PDF. It may be scanned images or password-protected.'
      );
    }

    // If page array is available, format with clear page boundaries for the LLM
    if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
      const pageSections = result.pages
        .map((p, idx) => {
          const pageNum = p.num ?? idx + 1;
          const pageContent = (p.text || '').trim();
          return `[Page ${pageNum}]\n${pageContent}`;
        })
        .filter((sec) => sec.length > 0);

      const formattedText = pageSections.join('\n\n---\n\n').trim();

      return {
        text: formattedText || result.text.trim(),
        documentType: 'pdf',
        pageOrSlideCount: result.total || result.pages.length,
      };
    }

    return {
      text: result.text.trim(),
      documentType: 'pdf',
      pageOrSlideCount: result.total || 1,
    };
  } catch (err: unknown) {
    if (err instanceof DocumentParseError) throw err;
    const msg = err instanceof Error ? err.message : 'Unknown PDF parsing failure';
    throw new DocumentParseError(`Failed to parse PDF document: ${msg}`);
  }
}

/**
 * Parses PPTX presentations by reading XML slide archives,
 * preserving slide numbers and collecting slide texts.
 */
function parsePptx(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // PPTX slide XML files are stored in ppt/slides/slide{N}.xml
    const slideEntries = entries.filter((entry) =>
      /^ppt\/slides\/slide(\d+)\.xml$/i.test(entry.entryName)
    );

    if (slideEntries.length === 0) {
      throw new DocumentParseError(
        'Invalid or empty PPTX presentation: no slides were found in the archive.'
      );
    }

    // Sort slides numerically (slide1.xml, slide2.xml, ..., slide10.xml)
    slideEntries.sort((a, b) => {
      const matchA = a.entryName.match(/slide(\d+)\.xml/i);
      const matchB = b.entryName.match(/slide(\d+)\.xml/i);
      const numA = matchA ? parseInt(matchA[1], 10) : 0;
      const numB = matchB ? parseInt(matchB[1], 10) : 0;
      return numA - numB;
    });

    const slideTexts: string[] = [];
    const textTagRegex = /<a:t[^>]*>(.*?)<\/a:t>/gs;

    slideEntries.forEach((entry) => {
      const match = entry.entryName.match(/slide(\d+)\.xml/i);
      const slideNum = match ? match[1] : '?';
      const xml = entry.getData().toString('utf8');

      const extractedWords: string[] = [];
      let regexMatch: RegExpExecArray | null;
      while ((regexMatch = textTagRegex.exec(xml)) !== null) {
        // Decode common XML entities
        const decoded = regexMatch[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'");
        if (decoded.trim()) {
          extractedWords.push(decoded.trim());
        }
      }

      const slideContent = extractedWords.join(' ').trim();
      if (slideContent) {
        slideTexts.push(`[Slide ${slideNum}]\n${slideContent}`);
      }
    });

    if (slideTexts.length === 0) {
      throw new DocumentParseError(
        'No readable slide text found in the uploaded PPTX presentation.'
      );
    }

    return Promise.resolve({
      text: slideTexts.join('\n\n---\n\n'),
      documentType: 'pptx',
      pageOrSlideCount: slideEntries.length,
    });
  } catch (err: unknown) {
    if (err instanceof DocumentParseError) throw err;
    const msg = err instanceof Error ? err.message : 'Unknown PPTX parsing failure';
    throw new DocumentParseError(`Failed to parse PPTX presentation: ${msg}`);
  }
}

