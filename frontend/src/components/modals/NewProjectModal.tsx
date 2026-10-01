import React, { useState, useEffect } from 'react';
import { PlusCircle, X, Loader2, Sparkles, Building2, Landmark } from 'lucide-react';
import { fetchSampleModels } from '../../services/api';

interface SampleModelItem {
  id: string;
  name: string;
  description: string;
  schema_version: string;
  element_count: number;
}

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, description: string, schema: string) => Promise<void>;
  onLoadSample?: (sampleId: string) => Promise<void>;
  isLoading: boolean;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  onLoadSample,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<'blank' | 'sample'>('blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState('IFC4');
  const [samples, setSamples] = useState<SampleModelItem[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('duplex_residential');

  useEffect(() => {
    if (isOpen) {
      fetchSampleModels()
        .then((data) => setSamples(data))
        .catch((e) => console.warn('Could not load sample models:', e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'blank') {
      if (!name.trim()) return;
      await onCreateProject(name.trim(), description.trim(), schema);
      setName('');
      setDescription('');
    } else if (onLoadSample) {
      await onLoadSample(selectedSampleId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100">New Project & Onboarding</h3>
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

        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--canvas-bg)]">
          <button
            type="button"
            onClick={() => setActiveTab('blank')}
            className={`flex-1 py-2.5 text-xs font-medium text-center border-b-2 transition-colors ${
              activeTab === 'blank'
                ? 'border-cyan-400 text-cyan-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Blank Project
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sample')}
            className={`flex-1 py-2.5 text-xs font-medium text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'sample'
                ? 'border-cyan-400 text-cyan-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Sample Architectural Models</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {activeTab === 'blank' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Project Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern Residential Villa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[var(--control-bg)] text-xs text-slate-200 px-3 py-2 rounded-lg border border-[var(--border-subtle)] focus:outline-none focus:border-cyan-400/60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Project description, location, or notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[var(--control-bg)] text-xs text-slate-200 px-3 py-2 rounded-lg border border-[var(--border-subtle)] focus:outline-none focus:border-cyan-400/60"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  IFC Schema Version
                </label>
                <select
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                  className="w-full bg-[var(--control-bg)] text-xs text-slate-200 px-3 py-2 rounded-lg border border-[var(--border-subtle)] focus:outline-none focus:border-cyan-400/60"
                >
                  <option value="IFC4">IFC4 (Recommended standard)</option>
                  <option value="IFC2X3">IFC2X3 (Legacy compatibility)</option>
                  <option value="IFC4X3">IFC4X3 (Infrastructure extension)</option>
                </select>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Choose a pre-built architectural model with storeys, slabs, perimeter walls, and columns:
              </p>

              <div className="space-y-2">
                {samples.map((s) => {
                  const isSelected = selectedSampleId === s.id;
                  const Icon = s.id === 'duplex_residential' ? Building2 : Landmark;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSampleId(s.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-md'
                          : 'bg-[var(--control-bg)] border-[var(--border-subtle)] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                          <span className="text-xs font-semibold">{s.name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--dock-bg)] text-slate-300 border border-[var(--border-subtle)]">
                          {s.schema_version}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal pl-6">
                        {s.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || (activeTab === 'blank' && !name.trim())}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{activeTab === 'blank' ? 'Create Project' : 'Load Sample Model'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
