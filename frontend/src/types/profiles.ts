export type UiProfile = 'review' | 'modify' | 'query' | 'custom';

export interface CustomProfileSettings {
  showTopPill: boolean;
  showBottomDock: boolean;
  showContextualModifyBar: boolean;
  showViewControls: boolean;
  showCadToolbar: boolean;
  showCoordinateHud: boolean;
  showBreadcrumbs: boolean;
  showTreeDrawer: boolean;
  showPropertyInspector: boolean;
  showSnap: boolean;
  showMeasure: boolean;
  showSection: boolean;
  showRenderStyle: boolean;
  showCameraPresets: boolean;
}

export const DEFAULT_CUSTOM_PROFILE_SETTINGS: CustomProfileSettings = {
  showTopPill: true,
  showBottomDock: true,
  showContextualModifyBar: true,
  showViewControls: true,
  showCadToolbar: false,
  showCoordinateHud: true,
  showBreadcrumbs: true,
  showTreeDrawer: false,
  showPropertyInspector: true,
  showSnap: true,
  showMeasure: true,
  showSection: true,
  showRenderStyle: true,
  showCameraPresets: true,
};

export function getEffectiveProfileSettings(
  profile: UiProfile,
  customSettings: CustomProfileSettings
): CustomProfileSettings {
  switch (profile) {
    case 'review':
      return {
        showTopPill: true,
        showBottomDock: true,
        showContextualModifyBar: false, // Suppress CAD modify bar during review for pure spatial immersion
        showViewControls: true,
        showCadToolbar: false,
        showCoordinateHud: false,
        showBreadcrumbs: true,
        showTreeDrawer: false,
        showPropertyInspector: false,
        showSnap: false,
        showMeasure: true,
        showSection: true,
        showRenderStyle: true,
        showCameraPresets: true,
      };

    case 'modify':
      return {
        showTopPill: true,
        showBottomDock: true,
        showContextualModifyBar: true,
        showViewControls: true,
        showCadToolbar: true,
        showCoordinateHud: true,
        showBreadcrumbs: true,
        showTreeDrawer: false,
        showPropertyInspector: true,
        showSnap: true,
        showMeasure: true,
        showSection: true,
        showRenderStyle: true,
        showCameraPresets: true,
      };

    case 'query':
      return {
        showTopPill: true,
        showBottomDock: true,
        showContextualModifyBar: false, // In query mode, inspect properties without CAD editing controls
        showViewControls: true,
        showCadToolbar: false,
        showCoordinateHud: true,
        showBreadcrumbs: true,
        showTreeDrawer: true, // Hierarchy tree emphasized
        showPropertyInspector: true, // Inspector emphasized
        showSnap: false,
        showMeasure: true,
        showSection: true,
        showRenderStyle: true,
        showCameraPresets: true,
      };

    case 'custom':
    default:
      return customSettings;
  }
}
