import { useState, useCallback, useEffect, useRef } from 'react';

interface UseResizableOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
  direction?: 'left' | 'right';
}

export function useResizable({
  initialWidth,
  minWidth,
  maxWidth,
  storageKey,
  direction = 'left'
}: UseResizableOptions) {
  const [width, setWidth] = useState<number>(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
            return parsed;
          }
        }
      } catch {
        // ignore localStorage access issues
      }
    }
    return initialWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const startWidthRef = useRef(width);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  const resetWidth = useCallback(() => {
    setWidth(initialWidth);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, String(initialWidth));
      } catch {
        // ignore
      }
    }
  }, [initialWidth, storageKey]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartXRef.current;
      let newWidth: number;
      if (direction === 'left') {
        // Dragging left (negative deltaX) increases width for right-side panels
        newWidth = startWidthRef.current - deltaX;
      } else {
        // Dragging right (positive deltaX) increases width for left-side panels
        newWidth = startWidthRef.current + deltaX;
      }

      const clamped = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(clamped);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(width));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, direction, minWidth, maxWidth, storageKey, width]);

  useEffect(() => {
    if (storageKey && !isDragging) {
      try {
        localStorage.setItem(storageKey, String(width));
      } catch {
        // ignore
      }
    }
  }, [width, storageKey, isDragging]);

  return { width, isDragging, startResizing, resetWidth };
}
