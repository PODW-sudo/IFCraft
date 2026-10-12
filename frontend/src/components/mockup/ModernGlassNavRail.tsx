import React from 'react';
import { Box, Search, Ruler, Crosshair, Settings } from 'lucide-react';

export type NavRailTab = 'model' | 'search' | 'measure' | 'clash' | 'settings';

interface ModernGlassNavRailProps {
  activeTab: NavRailTab;
  onSelectTab: (tab: NavRailTab) => void;
}

export const ModernGlassNavRail: React.FC<ModernGlassNavRailProps> = ({
  activeTab,
  onSelectTab
}) => {
  const tabs = [
    { id: 'model' as NavRailTab, label: 'Model', icon: Box },
    { id: 'search' as NavRailTab, label: 'Search', icon: Search },
    { id: 'measure' as NavRailTab, label: 'Measure', icon: Ruler },
    { id: 'clash' as NavRailTab, label: 'Clash', icon: Crosshair },
    { id: 'settings' as NavRailTab, label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      className="w-16 flex flex-col items-center py-4 gap-3 select-none z-20"
      aria-label="Sidebar Navigation"
      data-qa="modern-glass-nav-rail"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`w-14 py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-white/60 backdrop-blur-xl border border-white/80 shadow-md text-blue-600 font-medium'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/30'
            }`}
            title={tab.label}
            aria-pressed={isActive}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-600'}`} />
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
