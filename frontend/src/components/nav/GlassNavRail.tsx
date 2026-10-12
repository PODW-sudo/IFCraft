import React from 'react';
import { FolderTree, Search, Ruler, Crosshair, Sparkles, Settings, PenTool } from 'lucide-react';

export type GlassNavTab = 'model' | 'cad' | 'search' | 'measure' | 'clash' | 'copilot' | 'settings';

interface GlassNavRailProps {
  activeTab?: GlassNavTab;
  onSelectTab: (tab: GlassNavTab) => void;
  isTreeOpen: boolean;
  onToggleTree: () => void;
  isCadOpen?: boolean;
  onToggleCad?: () => void;
  onOpenOmnibar: () => void;
  isMeasureActive: boolean;
  onToggleMeasure: () => void;
  isClashOpen: boolean;
  onToggleClash: () => void;
  isCopilotOpen: boolean;
  onToggleCopilot: () => void;
  onOpenSettings: () => void;
}

export const GlassNavRail: React.FC<GlassNavRailProps> = ({
  activeTab: _activeTab,
  onSelectTab,
  isTreeOpen,
  onToggleTree,
  isCadOpen = false,
  onToggleCad,
  onOpenOmnibar,
  isMeasureActive,
  onToggleMeasure,
  isClashOpen,
  onToggleClash,
  isCopilotOpen,
  onToggleCopilot,
  onOpenSettings
}) => {
  const tabs = [
    {
      id: 'model' as GlassNavTab,
      label: 'Model',
      icon: FolderTree,
      active: isTreeOpen,
      onClick: () => {
        onSelectTab('model');
        onToggleTree();
      }
    },
    {
      id: 'cad' as GlassNavTab,
      label: 'CAD Tools',
      icon: PenTool,
      active: isCadOpen,
      onClick: () => {
        onSelectTab('cad');
        if (onToggleCad) onToggleCad();
      }
    },
    {
      id: 'search' as GlassNavTab,
      label: 'Search',
      icon: Search,
      active: false,
      onClick: () => {
        onSelectTab('search');
        onOpenOmnibar();
      }
    },
    {
      id: 'measure' as GlassNavTab,
      label: 'Measure',
      icon: Ruler,
      active: isMeasureActive,
      onClick: () => {
        onSelectTab('measure');
        onToggleMeasure();
      }
    },
    {
      id: 'clash' as GlassNavTab,
      label: 'Clash',
      icon: Crosshair,
      active: isClashOpen,
      onClick: () => {
        onSelectTab('clash');
        onToggleClash();
      }
    },
    {
      id: 'copilot' as GlassNavTab,
      label: 'Copilot',
      icon: Sparkles,
      active: isCopilotOpen,
      onClick: () => {
        onSelectTab('copilot');
        onToggleCopilot();
      }
    },
    {
      id: 'settings' as GlassNavTab,
      label: 'Settings',
      icon: Settings,
      active: false,
      onClick: () => {
        onSelectTab('settings');
        onOpenSettings();
      }
    }
  ];

  return (
    <nav
      className="w-14 flex flex-col items-center py-3 gap-2 select-none z-20 bg-white/45 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-3xl shadow-xl shadow-slate-900/5"
      aria-label="Sidebar Navigation"
      data-qa="glass-nav-rail"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.active;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={tab.onClick}
            className={`w-11 py-2 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-150 cursor-pointer ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
            title={tab.label}
            aria-pressed={isActive}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[9px] tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
export default GlassNavRail;
