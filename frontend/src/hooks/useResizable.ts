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
  const currentWidthRef = useRef(width);
  currentWidthRef.current = width;

  const startResizing = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If PointerEvent, capture pointer to element
    if ('setPointerCapture' in e.currentTarget && 'pointerId' in e) {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture((e as React.PointerEvent).pointerId);
      } catch {
        // ignore if not supported
      }
    }

    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    startWidthRef.current = currentWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const resetWidth = useCallback(() => {
    setWidth(initialWidth);
    currentWidthRef.current = initialWidth;
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, String(initialWidth));
      } catch {
        // ignore
      }
    }
  }, [initialWidth, storageKey]);

  // Window event listeners for seamless drag anywhere on screen
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: MouseEvent | PointerEvent) => {
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
      currentWidthRef.current = clamped;
      setWidth(clamped);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(currentWidthRef.current));
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('mouseup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, direction, minWidth, maxWidth, storageKey]);

  return {
    width,
    isDragging,
    startResizing,
    resetWidth
  };
}
