import React, { useState } from 'react';
import { PlusCircle, X, Loader2 } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, description: string, schema: string) => Promise<void>;
  isLoading: boolean;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  isLoading
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState('IFC4');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreateProject(name.trim(), description.trim(), schema);
    setName('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#16191f] border border-[#262a33] rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262a33]">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-100">Create Blank IFC Project</h3>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Project Name <span className="text-sky-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Modern Residential Villa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0d0f12] text-xs text-slate-200 px-3 py-2 rounded border border-[#262a33] focus:outline-none focus:border-sky-500/60"
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
              className="w-full bg-[#0d0f12] text-xs text-slate-200 px-3 py-2 rounded border border-[#262a33] focus:outline-none focus:border-sky-500/60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              IFC Schema Version
            </label>
            <select
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              className="w-full bg-[#0d0f12] text-xs text-slate-200 px-3 py-2 rounded border border-[#262a33] focus:outline-none focus:border-sky-500/60"
            >
              <option value="IFC4">IFC4 (Recommended standard)</option>
              <option value="IFC2X3">IFC2X3 (Legacy compatibility)</option>
              <option value="IFC4X3">IFC4X3 (Infrastructure extension)</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#262a33]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Project</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
