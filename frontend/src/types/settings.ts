export type ViewportThemeId = 'dark-slate' | 'studio-gray' | 'deep-void' | 'blueprint-navy' | 'custom';
export type OrbitStyle = 'turntable' | 'free';
export type DistanceUnit = 'm' | 'mm' | 'cm' | 'ft' | 'in';
export type AngularUnit = 'deg' | 'rad';
export type ShadowQuality = 'off' | 'low' | 'high';
export type HighlightGeometryStyle = 'contours' | 'box';

export interface SelectionHighlightSettings {
  selectionColor: string;          // Hex e.g. '#00f0ff' or '#0284c7'
  selectionEdgeColor: string;      // Hex e.g. '#00f0ff'
  selectionFillOpacity: number;    // 0.0 - 0.8 (default 0.28)
  selectionEdgeOpacity: number;    // 0.0 - 1.0 (default 1.0)
  preselectionColor: string;       // Hex e.g. '#38bdf8'
  preselectionEdgeColor: string;   // Hex e.g. '#60a5fa'
  preselectionFillOpacity: number; // 0.0 - 0.5 (default 0.14)
  preselectionEdgeOpacity: number; // 0.0 - 1.0 (default 0.65)
  highlightStyle: HighlightGeometryStyle; // 'contours' (EdgesGeometry) vs 'box' (BoxHelper)
  xrayHighlight: boolean;          // Render through occluded walls
}

export interface NavigationCameraSettings {
  orbitStyle: OrbitStyle;          // 'turntable' | 'free'
  orbitSensitivity: number;        // 0.2 - 2.5 (default 1.0)
  panSensitivity: number;          // 0.2 - 2.5 (default 1.0)
  zoomSensitivity: number;         // 0.2 - 2.5 (default 1.0)
  invertZoom: boolean;             // Invert mouse wheel direction
  enableDamping: boolean;          // Inertial camera smoothing
  dampingFactor: number;           // 0.01 - 0.15 (default 0.05)
  dragThresholdPx: number;         // Pixels before drag classified (default 4)
}

export interface ViewportEnvironmentSettings {
  theme: ViewportThemeId;          // 'dark-slate' | 'studio-gray' | 'deep-void' | 'blueprint-navy'
  customCanvasColor?: string;
  showGrid: boolean;               // Ground GridHelper toggle
  gridSize: number;                // World units (default 50)
  gridDivisions: number;           // Subdivisions (default 50)
  gridAccentColor: string;         // Default '#22d3ee'
  gridBaseColor: string;           // Default '#252b36'
  showAxes: boolean;               // Origin coordinate axes helper
  shadowQuality: ShadowQuality;    // Shadow rendering quality
}

export interface UnitsSnappingSettings {
  distanceUnit: DistanceUnit;      // 'm' | 'mm' | 'cm' | 'ft' | 'in'
  unitPrecision: number;           // Decimal places: 0 - 4 (default 3)
  angularUnit: AngularUnit;        // 'deg' | 'rad'
  angularSnapStep: number;         // Snap angle in degrees (5, 15, 30, 45, 90; default 15)
  linearSnapStep: number;          // Translation snap in meters (0.1, 0.5, 1.0; default 0.5)
  screenSnapRadiusVertex: number;  // Pixel threshold for vertex snapping (default 24)
  screenSnapRadiusMidpoint: number;// Pixel threshold for edge midpoint snapping (default 18)
}

export interface EditorSettings {
  version: number;
  highlighting: SelectionHighlightSettings;
  navigation: NavigationCameraSettings;
  viewport: ViewportEnvironmentSettings;
  snapping: UnitsSnappingSettings;
}

export const THEME_COLOR_MAP: Record<ViewportThemeId, number> = {
  'dark-slate': 0x0b0d10,
  'studio-gray': 0x1e2229,
  'deep-void': 0x030507,
  'blueprint-navy': 0x0a1526,
  'custom': 0x0b0d10
};

export const THEME_OPTIONS: Array<{
  id: ViewportThemeId;
  label: string;
  desc: string;
  color: string;
}> = [
  { id: 'dark-slate', label: 'Dark Slate (Default)', desc: 'Minimalist high-contrast CAD black', color: '#0b0d10' },
  { id: 'studio-gray', label: 'Studio Gray', desc: 'Matte 18% neutral architectural gray', color: '#1e2229' },
  { id: 'deep-void', label: 'Deep Void', desc: 'Maximum contrast pitch black', color: '#030507' },
  { id: 'blueprint-navy', label: 'Blueprint Navy', desc: 'Architectural blueprint deep blue', color: '#0a1526' }
];

export const COLOR_PRESETS = [
  { name: 'Electric Cyan', hex: '#00f0ff' },
  { name: 'CAD Blue', hex: '#0284c7' },
  { name: 'Sky Glow', hex: '#38bdf8' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Emerald Neon', hex: '#10b981' },
  { name: 'Vivid Magenta', hex: '#ec4899' },
  { name: 'Coral Red', hex: '#f43f5e' },
  { name: 'Violet Beam', hex: '#8b5cf6' }
];

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  version: 1,
  highlighting: {
    selectionColor: '#00f0ff',
    selectionEdgeColor: '#00f0ff',
    selectionFillOpacity: 0.28,
    selectionEdgeOpacity: 1.0,
    preselectionColor: '#38bdf8',
    preselectionEdgeColor: '#60a5fa',
    preselectionFillOpacity: 0.14,
    preselectionEdgeOpacity: 0.65,
    highlightStyle: 'contours',
    xrayHighlight: false
  },
  navigation: {
    orbitStyle: 'turntable',
    orbitSensitivity: 1.0,
    panSensitivity: 1.0,
    zoomSensitivity: 1.0,
    invertZoom: false,
    enableDamping: true,
    dampingFactor: 0.05,
    dragThresholdPx: 4
  },
  viewport: {
    theme: 'dark-slate',
    showGrid: true,
    gridSize: 50,
    gridDivisions: 50,
    gridAccentColor: '#22d3ee',
    gridBaseColor: '#252b36',
    showAxes: false,
    shadowQuality: 'high'
  },
  snapping: {
    distanceUnit: 'm',
    unitPrecision: 3,
    angularUnit: 'deg',
    angularSnapStep: 15,
    linearSnapStep: 0.5,
    screenSnapRadiusVertex: 24,
    screenSnapRadiusMidpoint: 18
  }
};
