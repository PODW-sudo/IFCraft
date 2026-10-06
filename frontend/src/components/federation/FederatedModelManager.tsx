import React, { useState, useRef } from 'react';
import {
  Layers,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  X,
  Compass,
  AlertCircle
} from 'lucide-react';
import type { SubModel, DisciplineType } from '../../types/ifc';

interface FederatedModelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  subModels: SubModel[];
  hiddenModelIds: Set<string>;
  onToggleModelVisibility: (modelId: string) => void;
  onUploadSubModel: (file: File, discipline: DisciplineType, name?: string) => Promise<void>;
  onDeleteSubModel: (modelId: string) => Promise<void>;
  onLoadSampleDiscipline?: (discipline: 'STRUCT' | 'MEP') => Promise<void>;
}

const DISCIPLINE_COLORS: Record<DisciplineType, { label: string; badgeClass: string; dotColor: string }> = {
  ARCH: {
    label: 'Architecture',
    badgeClass: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
    dotColor: 'bg-slate-300'
  },
  STRUCT: {
    label: 'Structural',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    dotColor: 'bg-blue-400'
  },
  MEP: {
    label: 'MEP Services',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    dotColor: 'bg-amber-400'
  },
  CIVIL: {
    label: 'Civil & Site',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    dotColor: 'bg-emerald-400'
  },
  OTHER: {
    label: 'Specialty',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    dotColor: 'bg-purple-400'
  }
};

export const FederatedModelManager: React.FC<FederatedModelManagerProps> = ({
  isOpen,
  onClose,
  projectName,
  subModels,
  hiddenModelIds,
  onToggleModelVisibility,
  onUploadSubModel,
  onDeleteSubModel,
  onLoadSampleDiscipline
}) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineType>('STRUCT');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      await onUploadSubModel(file, selectedDiscipline, file.name.replace(/\.[^/.]+$/, ''));
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSampleClick = async (discipline: 'STRUCT' | 'MEP') => {
    if (!onLoadSampleDiscipline) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      await onLoadSampleDiscipline(discipline);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to load sample discipline');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Federated Model Coordination"
      data-qa="federation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-[var(--shadow-hud)] backdrop-blur-xl p-5 text-slate-100 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                Federated Model Coordination
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--control-bg)] text-slate-400 border border-[var(--border-subtle)]">
                  {1 + subModels.length} models
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Overlay and coordinate architectural, structural, and MEP disciplines in a unified coordinate frame.
              </p>
            </div>
          </div>
          <button
            data-qa="federation-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Model Layers List */}
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          {/* Main Architectural Model */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--control-bg)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{projectName || 'Main Architectural Model'}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-slate-500/20 text-slate-200 border-slate-500/40">
                    Primary / ARCH
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  Coordinate Origin (0,0,0)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleModelVisibility('main')}
                className={`p-1.5 rounded-lg transition-colors ${
                  hiddenModelIds.has('main')
                    ? 'text-slate-500 hover:text-slate-300 bg-[var(--control-hover)]'
                    : 'text-cyan-400 hover:text-cyan-300'
                }`}
                title={hiddenModelIds.has('main') ? 'Show Main Model' : 'Hide Main Model'}
              >
                {hiddenModelIds.has('main') ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Sub-Models */}
          {subModels.map((sm) => {
            const disciplineMeta = DISCIPLINE_COLORS[sm.discipline] || DISCIPLINE_COLORS.OTHER;
            const isHidden = hiddenModelIds.has(sm.id);

            return (
              <div
                key={sm.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--control-bg)] border border-[var(--border-subtle)]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${disciplineMeta.dotColor}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{sm.name}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${disciplineMeta.badgeClass}`}>
                        {sm.discipline}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {sm.element_count} elements • {(sm.file_size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    data-qa="submodel-eye-toggle"
                    onClick={() => onToggleModelVisibility(sm.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isHidden
                        ? 'text-slate-500 hover:text-slate-300 bg-[var(--control-hover)]'
                        : 'text-cyan-400 hover:text-cyan-300'
                    }`}
                    title={isHidden ? 'Show Sub-Model' : 'Hide Sub-Model'}
                  >
                    {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    data-qa="submodel-delete-btn"
                    onClick={() => onDeleteSubModel(sm.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove Sub-Model"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Attach Discipline Model Section */}
        <div className="p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">Attach Discipline Model</span>
            {/* Discipline Selector */}
            <div className="flex items-center gap-1">
              {(['STRUCT', 'MEP', 'CIVIL', 'ARCH'] as DisciplineType[]).map((disc) => (
                <button
                  key={disc}
                  data-qa={`submodel-discipline-${disc}`}
                  onClick={() => setSelectedDiscipline(disc)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                    selectedDiscipline === disc
                      ? DISCIPLINE_COLORS[disc].badgeClass + ' font-bold ring-1 ring-cyan-400/40'
                      : 'border-[var(--border-subtle)] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {disc}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".ifc,.ifczip"
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
              id="submodel-file-upload"
            />
            <label
              htmlFor="submodel-file-upload"
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-[var(--border-subtle)] hover:border-cyan-400/60 bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-xs text-slate-300 font-medium cursor-pointer transition-colors ${
                isUploading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>{isUploading ? 'Importing Model...' : 'Select IFC File to Attach'}</span>
            </label>

            {onLoadSampleDiscipline && (
              <div className="flex items-center gap-1.5">
                <button
                  data-qa="submodel-load-struct-sample"
                  onClick={() => handleSampleClick('STRUCT')}
                  disabled={isUploading}
                  className="px-2.5 py-2 rounded-xl bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-[11px] font-medium text-blue-300 border border-blue-500/30 transition-colors"
                  title="Load bundled Structural sample model"
                >
                  + STR Sample
                </button>
                <button
                  data-qa="submodel-load-mep-sample"
                  onClick={() => handleSampleClick('MEP')}
                  disabled={isUploading}
                  className="px-2.5 py-2 rounded-xl bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-[11px] font-medium text-amber-300 border border-amber-500/30 transition-colors"
                  title="Load bundled MEP sample model"
                >
                  + MEP Sample
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Shared World Coordinates: WGS84 / Local Placement</span>
          </div>
          <button
            data-qa="federation-done-btn"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-xs font-medium text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
