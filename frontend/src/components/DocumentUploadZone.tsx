import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Presentation, FileCode, CheckCircle2, AlertCircle, X, Sparkles, Loader2 } from 'lucide-react';

interface DocumentUploadZoneProps {
  onExtract: (file: File) => Promise<void>;
  isLoading: boolean;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  error?: string | null;
}

export const DocumentUploadZone: React.FC<DocumentUploadZoneProps> = ({
  onExtract,
  isLoading,
  selectedFile,
  setSelectedFile,
  error,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedExtensions = ['.md', '.txt', '.pdf', '.pptx'];
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB

  const validateAndSetFile = (file: File) => {
    setValidationError(null);
    const fileName = file.name.toLowerCase();
    const hasValidExt = allowedExtensions.some((ext) => fileName.endsWith(ext));

    if (!hasValidExt) {
      setValidationError(`Unsupported file type. Please upload a .md, .txt, .pdf, or .pptx file.`);
      return;
    }

    if (file.size > maxSizeBytes) {
      setValidationError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 10 MB limit.`);
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (filename: string) => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pptx')) return <Presentation className="w-8 h-8 text-amber-400" />;
    if (lower.endsWith('.pdf')) return <FileText className="w-8 h-8 text-rose-400" />;
    return <FileCode className="w-8 h-8 text-cyan-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt,.pdf,.pptx"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {!selectedFile ? (
        // Drag-and-drop empty dropzone
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 group ${
            isDragOver
              ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01] shadow-glow-cyan/30'
              : 'border-slate-700/80 hover:border-cyan-500/60 bg-brand-surface/60 hover:bg-slate-900/80'
          }`}
        >
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:border-cyan-500/50 group-hover:scale-105 transition-all shadow-inner">
            <UploadCloud className="w-7 h-7 text-cyan-400 group-hover:text-cyan-300" />
          </div>

          <h3 className="text-base font-bold text-white mb-1">
            Drag & drop your project document here, or <span className="text-cyan-400 underline decoration-cyan-500/40">browse</span>
          </h3>

          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Upload your pitch deck presentation, README file, or product specification to extract verifiable feature claims.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-slate-400">
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">.MD</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">.TXT</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">.PDF</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">.PPTX</span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-slate-500">Max size: 10 MB</span>
          </div>
        </div>
      ) : (
        // Selected File Preview Card
        <div className="p-5 rounded-2xl bg-brand-surface/80 border border-cyan-500/40 shadow-glow-cyan/20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                {getFileIcon(selectedFile.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate font-mono">
                  {selectedFile.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                  <span className="font-mono text-cyan-300 font-semibold">{formatFileSize(selectedFile.size)}</span>
                  <span>&bull;</span>
                  <span className="text-teal-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ready for extraction
                  </span>
                </div>
              </div>
            </div>

            {!isLoading && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Gemini AI will extract concrete, testable technical claims with citations.</span>
            </p>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => onExtract(selectedFile)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-cyan-400 text-slate-950 font-bold text-sm shadow-glow-cyan hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Extracting Claims...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Extract Claims</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Validation error message */}
      {(validationError || error) && (
        <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{validationError || error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

