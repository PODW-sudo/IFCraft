import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  X,
  Plus,
  Check,
  Edit2,
  Layers,
  Tag,
  Scale,
  Loader2,
  Box
} from 'lucide-react';
import type { ElementDetails, PropertySingle } from '../../types/ifc';
import { useResizable } from '../../hooks/useResizable';
import { ResizeHandle } from '../common/ResizeHandle';

interface PropertyInspectorProps {
  projectId: string | null;
  expressId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onPropertyUpdated?: () => void;
  transformInfo?: { position: [number, number, number]; rotation: [number, number, number] } | null;
  onWidthChange?: (width: number) => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
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
  const [editingKey, setEditingKey] = useState<string | null>(null); // "psetName:propName"
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const { width, isDragging, startResizing, resetWidth } = useResizable({
    initialWidth: 320,
    minWidth: 260,
    maxWidth: 680,
    storageKey: 'ifc_editor_property_inspector_width',
    direction: 'left'
  });

  useEffect(() => {
    if (onWidthChange && isOpen && expressId !== null) {
      onWidthChange(width);
    }
  }, [width, isOpen, expressId, onWidthChange]);

  // New property form state
  const [showAddProp, setShowAddProp] = useState(false);
  const [newPsetName, setNewPsetName] = useState('');
  const [newPropName, setNewPropName] = useState('');
  const [newPropVal, setNewPropVal] = useState('');
  const [newPropType, setNewPropType] = useState('IfcLabel');

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

    let parsedVal: string | number | boolean = editValue;
    if (prop.value_type === 'IfcReal' || prop.value_type === 'IfcLengthMeasure' || prop.value_type === 'IfcInteger') {
      const num = Number(editValue);
      if (!isNaN(num)) parsedVal = num;
    } else if (prop.value_type === 'IfcBoolean') {
      parsedVal = editValue.toLowerCase() === 'true';
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/elements/${expressId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pset_name: psetName,
          property_name: prop.name,
          value: parsedVal,
          value_type: prop.value_type
        })
      });

      if (!res.ok) throw new Error('Failed to update property');

      // Update local state
      setDetails((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          psets: prev.psets.map((pset) => {
            if (pset.name !== psetName) return pset;
            return {
              ...pset,
              properties: pset.properties.map((p) =>
                p.name === prop.name ? { ...p, value: parsedVal } : p
              )
            };
          })
        };
      });

      setEditingKey(null);
      if (onPropertyUpdated) onPropertyUpdated();
    } catch (err) {
      console.error('Failed to save property:', err);
      alert('Failed to save property to IFC backend.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || expressId === null || !newPsetName.trim() || !newPropName.trim()) return;

    setIsSaving(true);
    let parsedVal: string | number | boolean = newPropVal;
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

      // Refresh element details
      const detailRes = await fetch(`/api/projects/${projectId}/elements/${expressId}`);
      if (detailRes.ok) {
        const updated = await detailRes.json();
        setDetails(updated);
      }

      setShowAddProp(false);
      setNewPropName('');
      setNewPropVal('');
      if (onPropertyUpdated) onPropertyUpdated();
    } catch (err) {
      console.error('Failed to add property:', err);
      alert('Failed to add property to IFC backend.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || expressId === null) return null;

  return (
    <aside
      style={{ width: `${width}px` }}
      className="fixed right-4 top-16 bottom-6 z-30 flex flex-col bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl shadow-[var(--shadow-hud)] text-slate-200 overflow-hidden transition-all duration-200 animate-in fade-in-50 slide-in-from-right-4"
    >
      <ResizeHandle
        position="left"
        onMouseDown={startResizing}
        onDoubleClick={resetWidth}
        isDragging={isDragging}
      />
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border-subtle)] bg-[var(--control-bg)]/40">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Property Inspector
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xs p-1 rounded hover:bg-[var(--control-hover)] transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
            <span className="text-xs">Loading element attributes...</span>
          </div>
        ) : details ? (
          <>
            {/* Entity Summary Card */}
            <div className="p-3 rounded-xl bg-[var(--control-bg)]/60 border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white truncate max-w-[180px]">
                  {details.name}
                </span>
                <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-mono">
                  #{details.express_id}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Tag className="w-3 h-3 text-slate-500" />
                <span className="font-mono text-slate-300">{details.type}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate" title={details.global_id}>
                GUID: {details.global_id}
              </div>
            </div>

            {/* Live 3D Transform Coordinates Readout */}
            {transformInfo && (
              <div className="p-3 rounded-xl bg-[var(--control-bg)]/60 border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Box className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3D World Placement</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
                  <div className="bg-[var(--dock-bg)] p-1.5 rounded border border-[var(--border-subtle)]">
                    <span className="text-red-400 block text-[9px]">X</span>
                    {transformInfo.position[0].toFixed(2)}m
                  </div>
                  <div className="bg-[var(--dock-bg)] p-1.5 rounded border border-[var(--border-subtle)]">
                    <span className="text-emerald-400 block text-[9px]">Y</span>
                    {transformInfo.position[1].toFixed(2)}m
                  </div>
                  <div className="bg-[var(--dock-bg)] p-1.5 rounded border border-[var(--border-subtle)]">
                    <span className="text-cyan-400 block text-[9px]">Z</span>
                    {transformInfo.position[2].toFixed(2)}m
                  </div>
                </div>
              </div>
            )}

            {/* Quantities Section */}
            {details.quantities && Object.keys(details.quantities).length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quantities</span>
                </div>
                <div className="bg-[var(--control-bg)]/60 rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]/60 text-xs">
                  {Object.entries(details.quantities).map(([qName, qVal]) => (
                    <div key={qName} className="flex justify-between px-3 py-1.5">
                      <span className="text-slate-400">{qName}</span>
                      <span className="font-mono text-slate-200">
                        {typeof qVal === 'number' ? qVal.toFixed(3) : String(qVal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Property Sets (Psets) Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Property Sets</span>
                </div>
                <button
                  onClick={() => setShowAddProp((prev) => !prev)}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 px-1.5 py-0.5 rounded hover:bg-[var(--control-hover)]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Property</span>
                </button>
              </div>

              {/* Add Property Form */}
              {showAddProp && (
                <form
                  onSubmit={handleAddProperty}
                  className="p-3 bg-[var(--control-bg)]/90 rounded-xl border border-cyan-500/40 space-y-2 text-xs"
                >
                  <span className="font-semibold text-cyan-300 block">Add Property / Pset</span>
                  <input
                    type="text"
                    required
                    placeholder="Pset Name (e.g. Pset_WallCommon)"
                    value={newPsetName}
                    onChange={(e) => setNewPsetName(e.target.value)}
                    className="w-full bg-[var(--dock-bg)] px-2 py-1 rounded border border-[var(--border-subtle)] text-slate-200"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Property Name (e.g. FireRating)"
                    value={newPropName}
                    onChange={(e) => setNewPropName(e.target.value)}
                    className="w-full bg-[var(--dock-bg)] px-2 py-1 rounded border border-[var(--border-subtle)] text-slate-200"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Value (e.g. 60 min)"
                      value={newPropVal}
                      onChange={(e) => setNewPropVal(e.target.value)}
                      className="flex-1 bg-[var(--dock-bg)] px-2 py-1 rounded border border-[var(--border-subtle)] text-slate-200"
                    />
                    <select
                      value={newPropType}
                      onChange={(e) => setNewPropType(e.target.value)}
                      className="bg-[var(--dock-bg)] px-2 py-1 rounded border border-[var(--border-subtle)] text-slate-200"
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
                      className="px-2.5 py-1 rounded text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-3 py-1 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold"
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}

              {/* Pset List */}
              {details.psets && details.psets.length > 0 ? (
                details.psets.map((pset) => (
                  <div key={pset.name} className="bg-[var(--control-bg)]/60 rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                    <div className="px-3 py-1.5 bg-[var(--control-bg)] border-b border-[var(--border-subtle)] text-xs font-semibold text-slate-300">
                      {pset.name}
                    </div>
                    <div className="divide-y divide-[var(--border-subtle)]/60 text-xs">
                      {pset.properties.map((prop) => {
                        const isEditing = editingKey === `${pset.name}:${prop.name}`;
                        return (
                          <div key={prop.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--control-hover)]/40 transition-colors">
                            <span className="text-slate-400 font-medium truncate max-w-[120px]" title={prop.name}>
                              {prop.name}
                            </span>

                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-24 bg-slate-800 px-1.5 py-0.5 rounded border border-cyan-400 text-slate-100 font-mono text-xs focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveEdit(pset.name, prop)}
                                  disabled={isSaving}
                                  className="p-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold"
                                  title="Save"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1 rounded text-slate-400 hover:text-white"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-200 text-right truncate max-w-[110px]" title={String(prop.value)}>
                                  {prop.value !== null && prop.value !== undefined ? String(prop.value) : '—'}
                                </span>
                                <button
                                  onClick={() => handleStartEdit(pset.name, prop)}
                                  className="text-slate-500 hover:text-cyan-400 p-0.5 transition-colors"
                                  title="Edit property"
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
                ))
              ) : (
                <div className="text-center text-slate-500 text-xs py-4">
                  No Property Sets found on this entity.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center text-slate-500 text-xs py-8">
            Click an element in the 3D viewport to inspect its properties.
          </div>
        )}
      </div>
    </aside>
  );
};
