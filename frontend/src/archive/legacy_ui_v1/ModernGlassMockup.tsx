import React, { useState, useCallback } from 'react';
import { ModernGlassHeader } from './ModernGlassHeader';
import { ModernGlassNavRail, type NavRailTab } from './ModernGlassNavRail';
import { ModernGlassTree } from './ModernGlassTree';
import { ModernGlassCanvas, type CanvasTool } from './ModernGlassCanvas';
import { ModernGlassProperties } from './ModernGlassProperties';

interface ModernGlassMockupProps {
  onBackToApp?: () => void;
}

export const ModernGlassMockup: React.FC<ModernGlassMockupProps> = ({
  onBackToApp
}) => {
  const [activeNavTab, setActiveNavTab] = useState<NavRailTab>('model');
  const [activeTool, setActiveTool] = useState<CanvasTool>('orbit');
  const [selectedElement, setSelectedElement] = useState<string>('Walls');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Floating Panel Dimensions & Offsets for dynamic ViewCube/Triad positioning
  const [treeWidth, setTreeWidth] = useState<number>(290);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState<boolean>(false);
  const [propertiesWidth, setPropertiesWidth] = useState<number>(340);
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState<boolean>(false);

  const handleTreeWidthChange = useCallback((w: number, collapsed: boolean) => {
    setTreeWidth(w);
    setIsTreeCollapsed(collapsed);
  }, []);

  const handlePropertiesWidthChange = useCallback((w: number, collapsed: boolean) => {
    setPropertiesWidth(w);
    setIsPropertiesCollapsed(collapsed);
  }, []);

  // Effective layout offsets (Left = Rail 64px + Tree panel; Right = Properties panel)
  const leftOffset = 64 + (isTreeCollapsed ? 64 : treeWidth);
  const rightOffset = isPropertiesCollapsed ? 64 : propertiesWidth;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col font-sans select-none"
      style={{
        background: 'var(--glass-bg-gradient)'
      }}
      data-qa="modern-glass-mockup-root"
    >
      {/* 1. Full-screen 3D Viewport in the Background (Edge-to-Edge immersion below all glass panels) */}
      <div
        className="absolute inset-0 w-full h-full z-0 pointer-events-auto"
        aria-label="3D Model Full Viewport"
      >
        <ModernGlassCanvas
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onSelectBuildingElement={setSelectedElement}
          leftOffset={leftOffset}
          rightOffset={rightOffset}
        />
      </div>

      {/* 2. Top Frosted Glass Header (Floating at the top) */}
      <div className="relative z-30 pointer-events-auto">
        <ModernGlassHeader
          onBackToApp={onBackToApp}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      </div>

      {/* 3. Floating Overlay Workspace: Frosted Glass Panels Float OVER the 3D Canvas */}
      <div className="absolute inset-x-0 bottom-0 top-16 z-20 pointer-events-none p-4 flex justify-between overflow-hidden">
        {/* Leftmost Navigation Rail + Resizable Model Tree Panel */}
        <div className="flex gap-3 h-full pointer-events-auto items-start">
          <ModernGlassNavRail
            activeTab={activeNavTab}
            onSelectTab={setActiveNavTab}
          />

          <ModernGlassTree
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            fileName="Office_Building.ifc"
            onWidthChange={handleTreeWidthChange}
          />
        </div>

        {/* Rightmost Resizable Element Properties Inspector */}
        <div className="h-full pointer-events-auto flex items-start">
          <ModernGlassProperties
            selectedCategory={selectedElement}
            onWidthChange={handlePropertiesWidthChange}
          />
        </div>
      </div>
    </div>
  );
};

export default ModernGlassMockup;
