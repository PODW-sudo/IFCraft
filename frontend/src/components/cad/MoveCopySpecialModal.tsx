import React, { useState, useEffect } from 'react';
import {
  X,
  Crosshair,
  RotateCw,
  FlipHorizontal,
  Move,
  Copy,
  Compass
} from 'lucide-react';

export interface MoveCopySpecialModalProps {
  isOpen: boolean;
  expressId: number | null;
  pickedVector?: [number, number, number];
  onClose: () => void;
  onApplyLinear: (delta: [number, number, number], copies: number, isCopy: boolean) => void;
  onApplyRotate: (angleDegrees: number, axis: 'x' | 'y' | 'z', copies: number, isCopy: boolean) => void;
  onApplyMirror: (axis: 'x' | 'y' | 'z', isCopy: boolean) => void;
  onPickTwoPoints: () => void;
}

export const MoveCopySpecialModal: React.FC<MoveCopySpecialModalProps> = ({
  isOpen,
  expressId,
  pickedVector,
  onClose,
  onApplyLinear,
  onApplyRotate,
  onApplyMirror,
  onPickTwoPoints,
}) => {
  const [activeTab, setActiveTab] = useState<'linear' | 'rotate' | 'mirror'>('linear');

  // Linear tab state
  const [dxStr, setDxStr] = useState<string>('1.0');
  const [dyStr, setDyStr] = useState<string>('0.0');
  const [dzStr, setDzStr] = useState<string>('0.0');
  const [linearCopies, setLinearCopies] = useState<number>(1);
  const [keepOpen, setKeepOpen] = useState<boolean>(false);

  useEffect(() => {
    if (pickedVector) {
      setDxStr(pickedVector[0].toFixed(3));
      setDyStr(pickedVector[1].toFixed(3));
      setDzStr(pickedVector[2].toFixed(3));
    }
  }, [pickedVector]);

  // Rotate tab state
  const [rotateAxis, setRotateAxis] = useState<'x' | 'y' | 'z'>('z');
  const [rotateAngleStr, setRotateAngleStr] = useState<string>('90');
  const [rotateCopies, setRotateCopies] = useState<number>(1);

  // Mirror tab state
  const [mirrorAxis, setMirrorAxis] = useState<'x' | 'y' | 'z'>('x');
  const [mirrorIsCopy, setMirrorIsCopy] = useState<boolean>(true);

  if (!isOpen) return null;

  const parseNum = (val: string): number => {
    try {
      // Evaluate simple safe math like 2.5+0.5 or -1.2
      if (/^[0-9.+\-*\s/()]+$/.test(val)) {
        // eslint-disable-next-line no-eval
        const res = Function(`"use strict"; return (${val})`)();
        if (typeof res === 'number' && !isNaN(res)) return res;
      }
    } catch {
      // fallback
    }
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const handleExecuteLinear = (isCopy: boolean) => {
    const dx = parseNum(dxStr);
    const dy = parseNum(dyStr);
    const dz = parseNum(dzStr);
    onApplyLinear([dx, dy, dz], isCopy ? Math.max(1, linearCopies) : 1, isCopy);
    if (!keepOpen) onClose();
  };

  const handleExecuteRotate = (isCopy: boolean) => {
    const angle = parseNum(rotateAngleStr);
    onApplyRotate(angle, rotateAxis, isCopy ? Math.max(1, rotateCopies) : 1, isCopy);
    if (!keepOpen) onClose();
  };

  const handleExecuteMirror = () => {
    onApplyMirror(mirrorAxis, mirrorIsCopy);
    if (!keepOpen) onClose();
  };

  return (
    <div
      data-qa="move-copy-special-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto select-none p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-surface-dock border border-border-subtle shadow-2xl p-5 text-text-primary text-xs flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-cyan-400" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Move &amp; Copy Special
              </h2>
              <p className="text-[10px] text-text-secondary">
                Tekla-style precision mathematical transformations {expressId ? `for #${expressId}` : ''}
              </p>
            </div>
          </div>
          <button
            data-qa="special-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-canvas transition-colors"
            title="Close dialog"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 gap-1 bg-surface-canvas p-1 rounded-xl border border-border-subtle/60 text-[11px] font-medium">
          <button
            data-qa="special-tab-linear"
            onClick={() => setActiveTab('linear')}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'linear'
                ? 'bg-surface-dock text-cyan-400 font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Move size={12} />
            <span>Linear</span>
          </button>
          <button
            data-qa="special-tab-rotate"
            onClick={() => setActiveTab('rotate')}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'rotate'
                ? 'bg-surface-dock text-cyan-400 font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <RotateCw size={12} />
            <span>Rotate</span>
          </button>
          <button
            data-qa="special-tab-mirror"
            onClick={() => setActiveTab('mirror')}
            className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'mirror'
                ? 'bg-surface-dock text-cyan-400 font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <FlipHorizontal size={12} />
            <span>Mirror</span>
          </button>
        </div>

        {/* TAB 1: LINEAR MOVE / COPY */}
        {activeTab === 'linear' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between text-[11px] text-text-secondary">
              <span>Coordinate Offset Displacement:</span>
              <button
                data-qa="special-pick-2-points-btn"
                onClick={() => {
                  onClose();
                  onPickTwoPoints();
                }}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30 transition-colors"
                title="Pick two points in the 3D viewport to populate dX, dY, dZ"
              >
                <Crosshair size={11} /> Pick 2 Points...
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono">
              {/* dX (Red) */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                  <span>dX (m)</span>
                </label>
                <input
                  type="text"
                  value={dxStr}
                  onChange={(e) => setDxStr(e.target.value)}
                  className="bg-surface-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary text-xs font-mono outline-none focus:border-cyan-500"
                  placeholder="0.0"
                />
              </div>

              {/* dY (Green) */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <span>dY (m)</span>
                </label>
                <input
                  type="text"
                  value={dyStr}
                  onChange={(e) => setDyStr(e.target.value)}
                  className="bg-surface-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary text-xs font-mono outline-none focus:border-cyan-500"
                  placeholder="0.0"
                />
              </div>

              {/* dZ (Blue) */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-blue-400 flex items-center gap-1">
                  <span>dZ (m)</span>
                </label>
                <input
                  type="text"
                  value={dzStr}
                  onChange={(e) => setDzStr(e.target.value)}
                  className="bg-surface-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary text-xs font-mono outline-none focus:border-cyan-500"
                  placeholder="0.0"
                />
              </div>
            </div>

            {/* Copies Count */}
            <div className="flex items-center justify-between bg-surface-canvas p-2.5 rounded-xl border border-border-subtle/60">
              <div>
                <div className="font-semibold text-text-primary text-[11px]">Number of Copies</div>
                <div className="text-[10px] text-text-secondary">Set &gt; 1 to generate linear array copies</div>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={linearCopies}
                  onChange={(e) => setLinearCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-surface-dock border border-border-subtle rounded-lg px-2 py-1 text-center font-mono font-bold text-xs outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Tekla Keep Dialog Open Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-text-secondary select-none">
              <input
                type="checkbox"
                checked={keepOpen}
                onChange={(e) => setKeepOpen(e.target.checked)}
                className="accent-cyan-400 rounded cursor-pointer"
              />
              <span>Keep dialog open (apply consecutive transformations)</span>
            </label>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle">
              <button
                data-qa="special-move-btn"
                onClick={() => handleExecuteLinear(false)}
                className="py-2 px-3 rounded-xl bg-surface-canvas hover:bg-surface-canvas/80 border border-border-subtle font-semibold text-text-primary text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Move size={13} className="text-cyan-400" />
                <span>Move</span>
              </button>
              <button
                data-qa="special-copy-btn"
                data-qa-alias="special-execute-btn"
                onClick={() => handleExecuteLinear(true)}
                className="py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Copy size={13} />
                <span>Copy ({linearCopies})</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ROTATE SPECIAL */}
        {activeTab === 'rotate' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between text-[11px] text-text-secondary">
              <span>Rotation Axis:</span>
              <div className="flex items-center gap-1 bg-surface-canvas p-0.5 rounded-lg border border-border-subtle">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <button
                    key={axis}
                    onClick={() => setRotateAxis(axis)}
                    className={`px-2.5 py-0.5 rounded uppercase font-mono font-bold text-[10px] transition-colors ${
                      rotateAxis === axis
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {axis}
                  </button>
                ))}
              </div>
            </div>

            {/* Angle Input */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-text-secondary">Rotation Angle (Degrees):</label>
                <div className="flex items-center gap-1">
                  {[45, 90, 180].map((deg) => (
                    <button
                      key={deg}
                      onClick={() => setRotateAngleStr(deg.toString())}
                      className="px-1.5 py-0.2 rounded bg-surface-canvas hover:bg-surface-canvas/80 text-[9px] font-mono text-cyan-400 border border-border-subtle"
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={rotateAngleStr}
                onChange={(e) => setRotateAngleStr(e.target.value)}
                className="bg-surface-canvas border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary text-xs font-mono outline-none focus:border-cyan-500"
                placeholder="90"
              />
            </div>

            {/* Copies Count */}
            <div className="flex items-center justify-between bg-surface-canvas p-2.5 rounded-xl border border-border-subtle/60">
              <div>
                <div className="font-semibold text-text-primary text-[11px]">Number of Copies</div>
                <div className="text-[10px] text-text-secondary">Radial circular array count</div>
              </div>
              <input
                type="number"
                min="1"
                max="36"
                value={rotateCopies}
                onChange={(e) => setRotateCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-surface-dock border border-border-subtle rounded-lg px-2 py-1 text-center font-mono font-bold text-xs outline-none focus:border-cyan-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle">
              <button
                data-qa="special-rotate-move-btn"
                onClick={() => handleExecuteRotate(false)}
                className="py-2 px-3 rounded-xl bg-surface-canvas hover:bg-surface-canvas/80 border border-border-subtle font-semibold text-text-primary text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCw size={13} className="text-cyan-400" />
                <span>Rotate</span>
              </button>
              <button
                data-qa="special-rotate-copy-btn"
                onClick={() => handleExecuteRotate(true)}
                className="py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Copy size={13} />
                <span>Rotate &amp; Copy ({rotateCopies})</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: MIRROR SPECIAL */}
        {activeTab === 'mirror' && (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between text-[11px] text-text-secondary">
              <span>Mirror Reflection Plane:</span>
              <div className="flex items-center gap-1 bg-surface-canvas p-0.5 rounded-lg border border-border-subtle">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <button
                    key={axis}
                    onClick={() => setMirrorAxis(axis)}
                    className={`px-2.5 py-0.5 rounded uppercase font-mono font-bold text-[10px] transition-colors ${
                      mirrorAxis === axis
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Across {axis.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode selection: Copy vs In-Place */}
            <div className="flex items-center justify-between bg-surface-canvas p-2.5 rounded-xl border border-border-subtle/60">
              <div>
                <div className="font-semibold text-text-primary text-[11px]">Mirror Mode</div>
                <div className="text-[10px] text-text-secondary">Duplicate element or flip original in-place</div>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={mirrorIsCopy}
                  onChange={(e) => setMirrorIsCopy(e.target.checked)}
                  className="accent-cyan-400 rounded cursor-pointer"
                />
                <span className={mirrorIsCopy ? 'text-cyan-300' : 'text-text-secondary'}>
                  {mirrorIsCopy ? 'Create Copy' : 'In-Place'}
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-border-subtle">
              <button
                data-qa="special-mirror-apply-btn"
                onClick={handleExecuteMirror}
                className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <FlipHorizontal size={13} />
                <span>Execute Mirror ({mirrorIsCopy ? 'Copy' : 'Flip'})</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
