import React from 'react';
import { Search, Bell, SlidersHorizontal, ArrowLeft } from 'lucide-react';

interface ModernGlassHeaderProps {
  onBackToApp?: () => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

export const ModernGlassHeader: React.FC<ModernGlassHeaderProps> = ({
  onBackToApp,
  searchTerm = '',
  onSearchChange
}) => {
  return (
    <header
      className="h-16 px-6 flex items-center justify-between border-b border-white/40 bg-white/20 backdrop-blur-xl select-none z-30"
      data-qa="modern-glass-header"
    >
      {/* 1. Brand Logo & Title */}
      <div className="flex items-center gap-3">
        {/* Isometric 3D Cube Brand Icon */}
        <div className="relative w-8 h-8 flex items-center justify-center" title="IFC Viewer">
          <svg className="w-8 h-8 drop-shadow-sm" viewBox="0 0 36 36">
            {/* Top facet - Warm coral / amber */}
            <polygon points="18,3 32,11 18,19 4,11" className="fill-amber-500/90" />
            {/* Left facet - Sky blue */}
            <polygon points="4,11 18,19 18,34 4,26" className="fill-sky-400/90" />
            {/* Right facet - Royal blue */}
            <polygon points="18,19 32,11 32,26 18,34" className="fill-blue-600/90" />
          </svg>
        </div>

        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 drop-shadow-sm">
            IFC Viewer
          </h1>
          <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-white/50 border border-white/70 text-slate-600 shadow-sm hidden sm:inline-block">
            Modern Glass Mockup
          </span>
        </div>
      </div>

      {/* 2. Centered Frosted Search Bar */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative flex items-center w-full">
          <Search className="absolute left-4 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search in model..."
            className="w-full pl-11 pr-4 py-2 text-sm text-slate-800 placeholder-slate-500 bg-white/40 hover:bg-white/50 focus:bg-white/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-full border border-white/60 shadow-sm backdrop-blur-md transition-all"
            aria-label="Search in model"
          />
        </div>
      </div>

      {/* 3. Right Actions: Tools, Notifications, User Avatar */}
      <div className="flex items-center gap-3">
        {onBackToApp && (
          <button
            type="button"
            onClick={onBackToApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/50 hover:bg-white/70 border border-white/70 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-md transition-all cursor-pointer mr-1"
            title="Return to standard editor view"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Classic CAD</span>
          </button>
        )}

        {/* Quick Filter */}
        <button
          type="button"
          className="p-2 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white/50 transition-colors backdrop-blur-sm cursor-pointer"
          title="Search filters"
          aria-label="Search filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <button
          type="button"
          className="p-2 rounded-full text-slate-700 hover:text-slate-900 hover:bg-white/50 transition-colors backdrop-blur-sm cursor-pointer"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* User Avatar Circle */}
        <div
          className="w-8 h-8 rounded-full bg-white/60 border border-white/80 shadow-sm flex items-center justify-center text-xs font-semibold text-slate-800 cursor-pointer hover:bg-white/80 transition-colors"
          title="User Profile: DD"
        >
          DD
        </div>
      </div>
    </header>
  );
};
