import React from 'react';

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
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
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize panel (Double-click to reset width)"
      className={`group absolute top-0 bottom-0 z-30 flex items-center justify-center cursor-col-resize select-none touch-none w-3 transition-colors ${
        position === 'left' ? '-left-1.5' : '-right-1.5'
      } ${className}`}
    >
      {/* Visual boundary line indicator */}
      <div
        className={`w-0.5 h-full transition-all duration-150 ${
          isDragging
            ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]'
            : 'bg-transparent group-hover:bg-sky-500/70'
        }`}
      />

      {/* Subtle grip handle pill centered vertically */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-1 h-7 rounded-full transition-all duration-150 ${
          isDragging
            ? 'bg-sky-400 opacity-100 scale-y-110 shadow-sm'
            : 'bg-slate-500/80 opacity-0 group-hover:opacity-100'
        }`}
      />
    </div>
  );
};
