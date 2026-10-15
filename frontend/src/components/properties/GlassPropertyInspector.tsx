import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  X,
  Check,
  Edit2,
  Scale,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Layers,
  Copy,
  Search
} from 'lucide-react';
import type { ElementDetails, PropertySingle } from '../../types/ifc';
import { useResizable } from '../../hooks/useResizable';
import { ResizeHandle } from '../common/ResizeHandle';

interface GlassPropertyInspectorProps {
  projectId: string | null;
  expressId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onPropertyUpdated?: () => void;
  transformInfo?: { position: [number, number, number]; rotation: [number, number, number] } | null;
  onWidthChange?: (width: number, isCollapsed: boolean) => void;
}

export const GlassPropertyInspector: React.FC<GlassPropertyInspectorProps> = ({
  projectId,
  expressId,
  isOpen,
  onClose,
  onPropertyUpdated,
  transformInfo,
  onWidthChange
}) => {
  const [details, setDetails] = useState<ElementDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [showAddProp, setShowAddProp] = useState(false);
  const [newPsetName, setNewPsetName] = useState('');
  const [newPropName, setNewPropName] = useState('');
  const [newPropVal, setNewPropVal] = useState('');
  const [newPropType, setNewPropType] = useState('IfcLabel');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [psetSearch, setPsetSearch] = useState('');

  const handleCopyValue = (fieldKey: string, value: string | number) => {
    const text = String(value);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {}
    }
    setCopiedField(fieldKey);
    setTimeout(() => {
      setCopiedField((cur) => (cur === fieldKey ? null : cur));
    }, 2000);
  };

  const { width, isDragging, startResizing, resetWidth } = useResizable({
    initialWidth: 340,
    minWidth: 260,
    maxWidth: 600,
    storageKey: 'ifc_editor_property_inspector_width',
    direction: 'left'
  });

  useEffect(() => {
    if (onWidthChange && isOpen) {
      onWidthChange(width, isPanelCollapsed);
    }
  }, [width, isPanelCollapsed, isOpen, onWidthChange]);

  useEffect(() => {
    if (!projectId || expressId === null || !isOpen) {
      setDetails(null);
      return;
    }

    let isMounted = true;
    async function loadElement() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/elements/${expressId}`);
        if (!res.ok) throw new Error('Failed to load element details');
        const data = await res.json();
        if (isMounted) setDetails(data);
      } catch (err) {
        console.error('Failed to load element details:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadElement();
    return () => {
      isMounted = false;
    };
  }, [projectId, expressId, isOpen]);

  if (!isOpen) return null;

  const handleStartEdit = (psetName: string, prop: PropertySingle) => {
    setEditingKey(`${psetName}:${prop.name}`);
    setEditValue(prop.value !== null && prop.value !== undefined ? String(prop.value) : '');
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const handleSaveEdit = async (psetName: string, prop: PropertySingle) => {
    if (!projectId || expressId === null) return;
    setIsSaving(true);
    try {
      let parsedValue: any = editValue;
      const valType = prop.value_type || '';
      if (valType === 'IfcReal' || valType === 'IfcLengthMeasure' || valType === 'IfcPositiveLengthMeasure') {
        parsedValue = parseFloat(editValue);
      } else if (valType === 'IfcInteger') {
        parsedValue = parseInt(editValue, 10);
      } else if (valType === 'IfcBoolean') {
        parsedValue = editValue.toLowerCase() === 'true';
      }

      const res = await fetch(`/api/projects/${projectId}/elements/${expressId}/properties`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pset_name: psetName,
          name: prop.name,
          value: parsedValue
        })
      });

      if (!res.ok) throw new Error('Failed to save property edit');

      // Update local state
      setDetails((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          psets: prev.psets.map((pset) => {
            if (pset.name !== psetName) return pset;
            return {
              ...pset,
              properties: pset.properties.map((p) => {
                if (p.name !== prop.name) return p;
                return { ...p, value: parsedValue };
              })
            };
          })
        };
      });

      setEditingKey(null);
      onPropertyUpdated?.();
    } catch (err) {
      console.error('Failed to save property:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || expressId === null || !newPsetName.trim() || !newPropName.trim()) return;

    setIsSaving(true);
    let parsedVal: unknown = newPropVal.trim();
    if (newPropType === 'IfcReal' || newPropType === 'IfcLengthMeasure' || newPropType === 'IfcInteger') {
      const num = Number(newPropVal);
      if (!isNaN(num)) parsedVal = num;
    } else if (newPropType === 'IfcBoolean') {
      parsedVal = newPropVal.toLowerCase() === 'true';
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/elements/${expressId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pset_name: newPsetName.trim(),
          property_name: newPropName.trim(),
          value: parsedVal,
          value_type: newPropType
        })
      });

      if (!res.ok) throw new Error('Failed to add property');

      const detailRes = await fetch(`/api/projects/${projectId}/elements/${expressId}`);
      if (detailRes.ok) {
        const updated = await detailRes.json();
        setDetails(updated);
      }

      setShowAddProp(false);
      setNewPropName('');
      setNewPropVal('');
      onPropertyUpdated?.();
    } catch (err) {
      console.error('Failed to add property:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      style={{ width: isPanelCollapsed ? 56 : width }}
      className={`relative flex flex-col h-[calc(100vh-5.5rem)] glass-panel bg-[var(--glass-surface-panel)] backdrop-blur-2xl rounded-3xl border border-[var(--glass-border)] shadow-2xl shadow-slate-900/10 ${
        isDragging ? '' : 'transition-[width] duration-150'
      } overflow-hidden select-text z-20 ${
        isPanelCollapsed ? 'p-2' : 'p-3.5'
      }`}
      aria-label="Element Properties"
      data-qa="property-inspector"
      data-qa-drawer="property-inspector-drawer"
      data-qa-dock="glass-property-inspector"
    >
      {/* Left-edge Resize Handle */}
      {!isPanelCollapsed && (
        <ResizeHandle
          onMouseDown={startResizing}
          onDoubleClick={resetWidth}
          isDragging={isDragging}
          position="left"
        />
      )}

      {/* Header */}
      {isPanelCollapsed ? (
        <div className="flex flex-col items-center gap-1.5 pb-2 mb-2 border-b border-white/40 dark:border-white/10 shrink-0 w-full">
          <button
            type="button"
            data-qa="property-uncollapse-btn"
            onClick={() => setIsPanelCollapsed(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Expand Inspector (Uncollapse)"
            aria-label="Expand Inspector"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-qa="property-close-btn"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Close Inspector"
            aria-label="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/40 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 flex-1">
            <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <h2 className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100 uppercase">
              Element Properties
            </h2>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              data-qa="property-toggle-collapse-btn"
              onClick={() => setIsPanelCollapsed(true)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              title="Collapse Inspector"
              aria-label="Collapse Inspector"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-qa="property-close-btn"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Close Inspector"
              aria-label="Close Inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isPanelCollapsed && (
        <div
          onClick={() => setIsPanelCollapsed(false)}
          className="flex-1 flex flex-col items-center justify-center gap-3 cursor-pointer py-4 group"
          title="Click to expand Element Properties"
        >
          <div className="p-1.5 rounded-xl bg-blue-500/10 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors uppercase">
            Properties
          </span>
        </div>
      )}

      {!isPanelCollapsed && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-xs">Loading metadata...</span>
            </div>
          ) : details ? (
            <>
              {/* Identity Capsule */}
              <div className="glass-card bg-[var(--glass-surface-card)] rounded-2xl p-3 border border-[var(--glass-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-[10px] tracking-wide select-text">
                    {details.type}
                  </span>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span className="select-text">#{details.express_id}</span>
                    <button
                      type="button"
                      data-qa="copy-express-id-btn"
                      onClick={() => handleCopyValue('id', details.express_id)}
                      className="p-1 rounded hover:bg-white/60 dark:hover:bg-slate-700/60 text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 cursor-pointer"
                      title="Copy Express ID"
                      aria-label="Copy Express ID"
                    >
                      {copiedField === 'id' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate select-text">
                  {details.name || 'Unnamed Element'}
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="truncate select-text">GUID: {details.global_id}</span>
                  <button
                    type="button"
                    data-qa="copy-guid-btn"
                    onClick={() => handleCopyValue('guid', details.global_id)}
                    className="p-1 rounded hover:bg-white/60 dark:hover:bg-slate-700/60 text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 cursor-pointer shrink-0 ml-1"
                    title="Copy Global ID (GUID)"
                    aria-label="Copy Global ID"
                  >
                    {copiedField === 'guid' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Transform Position & Orientation Readouts */}
              {transformInfo && (
                <div className="glass-card bg-[var(--glass-surface-card)] rounded-2xl p-3 border border-[var(--glass-border)] space-y-1.5 text-xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Spatial Placement
                  </div>
                  <div className="grid grid-cols-3 gap-1 font-mono text-[11px] tabular-nums">
                    <div className="glass-card bg-[var(--glass-surface-card)] rounded-lg p-1.5 text-center border border-[var(--glass-border)]">
                      <span className="text-slate-400 block text-[9px]">X</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{transformInfo.position[0].toFixed(2)}m</span>
                    </div>
                    <div className="glass-card bg-[var(--glass-surface-card)] rounded-lg p-1.5 text-center border border-[var(--glass-border)]">
                      <span className="text-slate-400 block text-[9px]">Y</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{transformInfo.position[1].toFixed(2)}m</span>
                    </div>
                    <div className="glass-card bg-[var(--glass-surface-card)] rounded-lg p-1.5 text-center border border-[var(--glass-border)]">
                      <span className="text-slate-400 block text-[9px]">Z</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{transformInfo.position[2].toFixed(2)}m</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quantities */}
              {details.quantities && Object.keys(details.quantities).length > 0 && (
                <div className="glass-card bg-[var(--glass-surface-card)] rounded-2xl p-3 border border-[var(--glass-border)] space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <Scale className="w-3.5 h-3.5 text-blue-600" />
                    <span>Quantities</span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(details.quantities).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 dark:text-slate-400">{key}</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {typeof val === 'number' ? val.toFixed(2) : String(val ?? '')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Property Sets (Psets) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                    <span>Property Sets ({details.psets?.length || 0})</span>
                  </div>
                  <button
                    type="button"
                    data-qa="property-add-btn"
                    onClick={() => setShowAddProp((prev) => !prev)}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 px-2 py-0.5 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Property</span>
                  </button>
                </div>

                {/* Search Filter for Properties */}
                {details.psets && details.psets.length > 2 && (
                  <div className="relative flex items-center px-0.5">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter properties..."
                      value={psetSearch}
                      onChange={(e) => setPsetSearch(e.target.value)}
                      className="w-full pl-7 pr-7 py-1 text-xs rounded-xl glass-card bg-[var(--glass-surface-card)] border border-[var(--glass-border)] text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {psetSearch && (
                      <button
                        type="button"
                        onClick={() => setPsetSearch('')}
                        className="absolute right-2.5 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                        title="Clear filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {/* Add Property Form */}
                {showAddProp && (
                  <form
                    onSubmit={handleAddProperty}
                    className="p-3 bg-white/60 dark:bg-slate-800/80 rounded-2xl border border-blue-500/30 space-y-2 text-xs"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">Add Property / Pset</span>
                    <input
                      type="text"
                      required
                      placeholder="Pset Name (e.g. Pset_WallCommon)"
                      value={newPsetName}
                      onChange={(e) => setNewPsetName(e.target.value)}
                      className="w-full bg-white/70 dark:bg-slate-900/70 px-2 py-1 rounded-lg border border-white/60 dark:border-white/10 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Property Name (e.g. FireRating)"
                      value={newPropName}
                      onChange={(e) => setNewPropName(e.target.value)}
                      className="w-full bg-white/70 dark:bg-slate-900/70 px-2 py-1 rounded-lg border border-white/60 dark:border-white/10 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Value (e.g. 60 min)"
                        value={newPropVal}
                        onChange={(e) => setNewPropVal(e.target.value)}
                        className="flex-1 bg-white/70 dark:bg-slate-900/70 px-2 py-1 rounded-lg border border-white/60 dark:border-white/10 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <select
                        value={newPropType}
                        onChange={(e) => setNewPropType(e.target.value)}
                        className="bg-white/70 dark:bg-slate-900/70 px-2 py-1 rounded-lg border border-white/60 dark:border-white/10 text-slate-800 dark:text-slate-200 outline-none"
                      >
                        <option value="IfcLabel">Label</option>
                        <option value="IfcText">Text</option>
                        <option value="IfcReal">Real</option>
                        <option value="IfcBoolean">Boolean</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddProp(false)}
                        className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-3 py-1 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}

                {details.psets
                  ?.filter((pset) => {
                    if (!psetSearch.trim()) return true;
                    const q = psetSearch.toLowerCase();
                    if (pset.name.toLowerCase().includes(q)) return true;
                    return pset.properties.some(
                      (p) => p.name.toLowerCase().includes(q) || String(p.value ?? '').toLowerCase().includes(q)
                    );
                  })
                  .map((pset) => (
                  <div
                    key={pset.name}
                    className="glass-card bg-[var(--glass-surface-card)] rounded-2xl p-3 border border-[var(--glass-border)] space-y-2"
                  >
                    <div
                      data-qa="pset-header"
                      className="text-xs font-semibold text-slate-800 dark:text-slate-200 border-b border-white/30 dark:border-white/10 pb-1"
                    >
                      {pset.name}
                    </div>

                    <div className="space-y-1.5">
                      {pset.properties.map((prop) => {
                        const isEditing = editingKey === `${pset.name}:${prop.name}`;

                        return (
                          <div
                            key={prop.name}
                            className="flex items-center justify-between text-xs py-0.5 group"
                          >
                            <span className="text-slate-500 dark:text-slate-400 max-w-[120px] truncate select-text" title={prop.name}>
                              {prop.name}
                            </span>

                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-20 px-1 py-0.5 text-xs bg-white/70 dark:bg-slate-700 rounded border border-blue-500 outline-none"
                                />
                                <button
                                  onClick={() => handleSaveEdit(pset.name, prop)}
                                  disabled={isSaving}
                                  className="p-1 rounded text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-800 dark:text-slate-200 text-right max-w-[140px] truncate select-text cursor-text" title={String(prop.value ?? '')}>
                                  {prop.value !== null && prop.value !== undefined ? String(prop.value) : '—'}
                                </span>
                                <button
                                  data-qa="property-edit-btn"
                                  onClick={() => handleStartEdit(pset.name, prop)}
                                  className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                  title="Edit value"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 text-center py-8">
              Select an element to view properties
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
export default GlassPropertyInspector;
