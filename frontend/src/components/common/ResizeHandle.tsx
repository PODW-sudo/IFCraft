import React from 'react';

interface ResizeHandleProps {
  onMouseDown: (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: () => void;
  isDragging?: boolean;
  position: 'left' | 'right';
  className?: string;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  onMouseDown,
  onDoubleClick,
  isDragging = false,
  position,
  className = ''
}) => {
  return (
    <div
      onPointerDown={onMouseDown}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      role="separator"
      aria-orientation="vertical"
      data-qa="resize-handle"
      data-qa-position={position}
      title="Drag to resize panel (Double-click to reset width)"
      className={`group absolute top-0 bottom-0 z-40 flex items-center justify-center cursor-col-resize select-none touch-none w-4 transition-colors ${
        position === 'left' ? '-left-2' : '-right-2'
      } ${className}`}
    >
      {/* Visual boundary line indicator */}
      <div
        className={`pointer-events-none w-0.5 h-full transition-all duration-150 ${
          isDragging
            ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
            : 'bg-transparent group-hover:bg-cyan-500/70'
        }`}
      />

      {/* Subtle grip handle pill centered vertically */}
      <div
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-full transition-all duration-150 ${
          isDragging
            ? 'bg-cyan-400 opacity-100 scale-y-110 shadow-sm'
            : 'bg-slate-500/80 opacity-0 group-hover:opacity-100'
        }`}
      />
    </div>
  );
};
