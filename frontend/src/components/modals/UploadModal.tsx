import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  loadingStage: string;
  loadingPercent: number;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onFileSelected,
  isLoading,
  loadingStage,
  loadingPercent
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.ifc') || file.name.toLowerCase().endsWith('.ifczip')) {
        onFileSelected(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100">Upload IFC Model</h3>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[var(--control-hover)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
              <p className="text-sm font-medium text-slate-200 mb-1">{loadingStage || 'Processing IFC File...'}</p>
              <p className="text-xs text-slate-400 mb-4">Parsing geometry and schema in dedicated Web Worker</p>

              {/* Progress bar */}
              <div className="w-full bg-[var(--canvas-bg)] h-2 rounded-full overflow-hidden border border-[var(--border-subtle)]">
                <div
                  className="bg-cyan-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(5, loadingPercent)}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500 font-mono mt-2">{loadingPercent}%</span>
            </div>
          ) : (
            <>
              {/* Drop area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-[var(--border-subtle)] hover:border-slate-500 bg-[var(--canvas-bg)]/50 hover:bg-[var(--canvas-bg)]'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-[var(--control-bg)] flex items-center justify-center text-slate-300 mb-3 border border-[var(--border-subtle)]">
                  <FileText className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-sm font-medium text-slate-200 text-center mb-1">
                  Drag and drop your <span className="text-cyan-400">.ifc</span> file here
                </p>
                <p className="text-xs text-slate-500 text-center">
                  or click to browse from local computer
                </p>
                <span className="mt-3 text-[10px] text-slate-400 bg-[var(--control-bg)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                  Supports IFC2X3, IFC4, IFC4X3
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".ifc,.ifczip"
                onChange={handleFileChange}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
