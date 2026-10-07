import React from 'react';
import type { ElementDetails } from '../../types/ifc';
import type { InteractiveEditMode } from '../../types/cadEditing';
import { PetPalette } from './PetPalette';

export interface SelectionContextOverlayProps {
  expressId: number | null;
  elementDetails: ElementDetails | null;
  screenPosition: { x: number; y: number } | null;
  storeys?: { id: number; name: string; elevation: number }[];
  isPinned?: boolean;
  activeTool?: InteractiveEditMode;
  onStartMove?: () => void;
  onStartRotate?: () => void;
  onQuickRotate?: (clockwise: boolean) => void;
  onStartMirror?: () => void;
  onStartElevate?: () => void;
  onStartMultiply?: () => void;
  onOpenSpecialModal?: () => void;
  onClone: (expressId: number) => void;
  onDelete: (expressId: number) => void;
  onUpdateGeometry: (expressId: number, params: { height?: number; thickness?: number; elevation?: number }) => void;
  onAssignStorey: (expressId: number, storeyId: number) => void;
  onAssignMaterial: (expressId: number, materialName: string, colorHex?: string) => void;
  onFocus: (expressId: number) => void;
  onOpenInspector: () => void;
  onMove?: (expressId: number, delta: [number, number, number]) => void;
  onRotate?: (expressId: number, angle_degrees: number, axis: 'x' | 'y' | 'z') => void;
  onMirror?: (expressId: number, axis: 'x' | 'y' | 'z', is_copy: boolean) => void;
  onArray?: (expressId: number, count: number, delta: [number, number, number]) => void;
  onAlign?: (expressId: number, axis: 'x' | 'y' | 'z', target_value?: number) => void;
  onTogglePin?: (expressId: number) => void;
}

export const SelectionContextOverlay: React.FC<SelectionContextOverlayProps> = ({
  expressId,
  elementDetails,
  screenPosition,
  storeys = [],
  isPinned = false,
  activeTool = 'none',
  onStartMove = () => {},
  onStartRotate = () => {},
  onQuickRotate = () => {},
  onStartMirror = () => {},
  onStartElevate = () => {},
  onStartMultiply = () => {},
  onOpenSpecialModal = () => {},
  onClone,
  onDelete,
  onUpdateGeometry,
  onAssignStorey,
  onAssignMaterial,
  onFocus,
  onOpenInspector,
  onTogglePin = () => {},
}) => {
  return (
    <PetPalette
      expressId={expressId}
      elementDetails={elementDetails}
      screenPosition={screenPosition}
      activeTool={activeTool}
      isPinned={isPinned}
      storeys={storeys}
      onStartMove={onStartMove}
      onStartRotate={onStartRotate}
      onQuickRotate={onQuickRotate}
      onStartMirror={onStartMirror}
      onStartElevate={onStartElevate}
      onStartMultiply={onStartMultiply}
      onOpenSpecialModal={onOpenSpecialModal}
      onClone={onClone}
      onDelete={onDelete}
      onTogglePin={onTogglePin}
      onFocus={onFocus}
      onOpenInspector={onOpenInspector}
      onUpdateGeometry={onUpdateGeometry}
      onAssignStorey={onAssignStorey}
      onAssignMaterial={onAssignMaterial}
    />
  );
};
