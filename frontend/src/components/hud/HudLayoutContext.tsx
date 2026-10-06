import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export interface HudRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HudLayoutContextType {
  registerHud: (id: string, defaultBounds: { x: number; y: number; width?: number; height?: number }) => { x: number; y: number };
  unregisterHud: (id: string) => void;
  updateHudBounds: (id: string, bounds: Partial<HudRect>) => void;
  getHud: (id: string) => HudRect | undefined;
  resolveOverlap: (draggedId: string, candidateX: number, candidateY: number, width: number, height: number) => { x: number; y: number };
}

const CLEARANCE = 12; // 12px margin between floating HUDs

const HudLayoutContext = createContext<HudLayoutContextType | null>(null);

export const HudLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [huds, setHuds] = useState<Map<string, HudRect>>(new Map());
  const hudsRef = useRef<Map<string, HudRect>>(new Map());
  hudsRef.current = huds;

  const clampToViewport = useCallback((x: number, y: number, width: number, height: number) => {
    const maxX = Math.max(0, (typeof window !== 'undefined' ? window.innerWidth : 1440) - width - 8);
    const maxY = Math.max(0, (typeof window !== 'undefined' ? window.innerHeight : 900) - height - 8);
    return {
      x: Math.max(8, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY))
    };
  }, []);

  const resolveOverlap = useCallback(
    (draggedId: string, candidateX: number, candidateY: number, width: number, height: number): { x: number; y: number } => {
      let { x, y } = clampToViewport(candidateX, candidateY, width, height);

      // Check against all other registered HUDs
      const otherHuds = Array.from(hudsRef.current.values()).filter((h) => h.id !== draggedId);

      for (let iteration = 0; iteration < 4; iteration++) {
        let collided = false;
        for (const other of otherHuds) {
          // Check AABB intersection with CLEARANCE margin
          const overlapX = x < other.x + other.width + CLEARANCE && x + width + CLEARANCE > other.x;
          const overlapY = y < other.y + other.height + CLEARANCE && y + height + CLEARANCE > other.y;

          if (overlapX && overlapY) {
            collided = true;
            // Calculate minimum displacement
            const pushLeft = other.x - width - CLEARANCE;
            const pushRight = other.x + other.width + CLEARANCE;
            const pushUp = other.y - height - CLEARANCE;
            const pushDown = other.y + other.height + CLEARANCE;

            const distLeft = Math.abs(x - pushLeft);
            const distRight = Math.abs(x - pushRight);
            const distUp = Math.abs(y - pushUp);
            const distDown = Math.abs(y - pushDown);

            const minDist = Math.min(distLeft, distRight, distUp, distDown);

            if (minDist === distDown) {
              y = pushDown;
            } else if (minDist === distRight) {
              x = pushRight;
            } else if (minDist === distUp) {
              y = pushUp;
            } else {
              x = pushLeft;
            }

            const clamped = clampToViewport(x, y, width, height);
            x = clamped.x;
            y = clamped.y;
          }
        }
        if (!collided) break;
      }

      return { x, y };
    },
    [clampToViewport]
  );

  const registerHud = useCallback(
    (id: string, defaultBounds: { x: number; y: number; width?: number; height?: number }): { x: number; y: number } => {
      const existing = hudsRef.current.get(id);
      if (existing) {
        return { x: existing.x, y: existing.y };
      }
      const width = defaultBounds.width || 200;
      const height = defaultBounds.height || 40;
      const resolved = resolveOverlap(id, defaultBounds.x, defaultBounds.y, width, height);

      const newEntry: HudRect = {
        id,
        x: resolved.x,
        y: resolved.y,
        width,
        height
      };
      const nextMap = new Map(hudsRef.current);
      nextMap.set(id, newEntry);
      hudsRef.current = nextMap;
      setHuds(nextMap);

      return resolved;
    },
    [resolveOverlap]
  );

  const unregisterHud = useCallback((id: string) => {
    const nextMap = new Map(hudsRef.current);
    if (!nextMap.has(id)) return;
    nextMap.delete(id);
    hudsRef.current = nextMap;
    setHuds(nextMap);
  }, []);

  const updateHudBounds = useCallback((id: string, bounds: Partial<HudRect>) => {
    const existing = hudsRef.current.get(id);
    if (!existing) return;
    const nextMap = new Map(hudsRef.current);
    nextMap.set(id, {
      ...existing,
      ...bounds
    });
    hudsRef.current = nextMap;
    setHuds(nextMap);
  }, []);

  const getHud = useCallback((id: string) => {
    return hudsRef.current.get(id);
  }, []);

  return (
    <HudLayoutContext.Provider
      value={{
        registerHud,
        unregisterHud,
        updateHudBounds,
        getHud,
        resolveOverlap
      }}
    >
      {children}
    </HudLayoutContext.Provider>
  );
};

export function useDraggableHud(
  id: string,
  defaultPos: { x: number; y: number; width?: number; height?: number }
) {
  const context = useContext(HudLayoutContext);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: defaultPos.x, y: defaultPos.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  // Register on mount
  useEffect(() => {
    if (context) {
      const resolved = context.registerHud(id, defaultPos);
      if (resolved && (resolved.x !== defaultPos.x || resolved.y !== defaultPos.y)) {
        setPos(resolved);
      }
    }
    return () => {
      if (context) {
        context.unregisterHud(id);
      }
    };
  }, [id, context]);

  // Sync measured DOM dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !context) return;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      context.updateHudBounds(id, { width: rect.width, height: rect.height });
    }
  }, [id, context]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only drag with primary left mouse button
      if (e.button !== 0) return;
      e.stopPropagation();

      const el = containerRef.current;
      const target = e.target as HTMLElement;
      // Do not initiate drag if user clicked an interactive input/button inside the bar
      if (target.closest('button, input, select, textarea, [role=\"menuitem\"]') && !target.closest('[data-drag-handle]')) {
        return;
      }

      setIsDragging(true);
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: pos.x,
        initialY: pos.y
      };

      if (el) {
        el.setPointerCapture(e.pointerId);
      }
    },
    [pos.x, pos.y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      e.stopPropagation();

      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;

      const candidateX = dragStartRef.current.initialX + dx;
      const candidateY = dragStartRef.current.initialY + dy;

      const el = containerRef.current;
      const width = el?.offsetWidth || defaultPos.width || 200;
      const height = el?.offsetHeight || defaultPos.height || 40;

      if (context) {
        const resolved = context.resolveOverlap(id, candidateX, candidateY, width, height);
        setPos(resolved);
        context.updateHudBounds(id, { x: resolved.x, y: resolved.y, width, height });
      } else {
        setPos({ x: candidateX, y: candidateY });
      }
    },
    [isDragging, context, id, defaultPos.width, defaultPos.height]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      dragStartRef.current = null;
      const el = containerRef.current;
      if (el && el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    },
    [isDragging]
  );

  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    transform: 'none',
    zIndex: isDragging ? 60 : 35,
    userSelect: 'none',
    touchAction: 'none'
  };

  const dragProps = {
    'data-qa-draggable-hud': id,
    'data-qa-hud-x': pos.x,
    'data-qa-hud-y': pos.y,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp
  };

  return {
    ref: containerRef,
    pos,
    setPos,
    isDragging,
    style,
    dragProps
  };
}
