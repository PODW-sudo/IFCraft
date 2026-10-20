import { useState, useCallback } from 'react';
import type { TransformMode } from '../components/viewer/ThreeViewport';
import type { ProjectMetadata } from '../types/ifc';
import type { CollaborationClient } from '../services/collaboration';

export interface UseGizmoTransformOptions {
  currentProject: ProjectMetadata | null;
  collabClientRef: React.RefObject<CollaborationClient | null>;
}

export function useGizmoTransform({ currentProject, collabClientRef }: UseGizmoTransformOptions) {
  const [transformMode, setTransformMode] = useState<TransformMode>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [transformInfo, setTransformInfo] = useState<{
    position: [number, number, number];
    rotation: [number, number, number];
  } | null>(null);

  const toggleSnap = useCallback(() => {
    setSnapEnabled((prev) => !prev);
  }, []);

  const handleTransformChange = useCallback(
    (_expressID: number, pos: [number, number, number], rot: [number, number, number]) => {
      setTransformInfo({ position: pos, rotation: rot });
    },
    []
  );

  const handleTransformEnd = useCallback(
    async (expressID: number, matrix: number[]) => {
      if (!currentProject) return;

      // Broadcast commit over WebSocket for multi-user sync
      collabClientRef.current?.commitTransform(expressID, matrix);

      try {
        const res = await fetch(
          `/api/projects/${currentProject.id}/elements/${expressID}/placement`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matrix })
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          console.error('Failed to persist transform to backend:', err.detail);
        }
      } catch (err) {
        console.error('Network error persisting transform:', err);
      }
    },
    [currentProject, collabClientRef]
  );

  const resetTransform = useCallback(() => {
    setTransformInfo(null);
    setTransformMode('select');
  }, []);

  return {
    transformMode,
    setTransformMode,
    snapEnabled,
    setSnapEnabled,
    toggleSnap,
    transformInfo,
    setTransformInfo,
    handleTransformChange,
    handleTransformEnd,
    resetTransform
  };
}
