import type { EditorSettings, DistanceUnit } from '../types/settings';
import { DEFAULT_EDITOR_SETTINGS } from '../types/settings';

const STORAGE_KEY = 'ifc_editor_settings_v1';

export function loadEditorSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EDITOR_SETTINGS;
    const parsed = JSON.parse(raw);
    // Deep merge to ensure all keys exist
    return {
      version: DEFAULT_EDITOR_SETTINGS.version,
      highlighting: {
        ...DEFAULT_EDITOR_SETTINGS.highlighting,
        ...(parsed.highlighting || {})
      },
      navigation: {
        ...DEFAULT_EDITOR_SETTINGS.navigation,
        ...(parsed.navigation || {})
      },
      viewport: {
        ...DEFAULT_EDITOR_SETTINGS.viewport,
        ...(parsed.viewport || {})
      },
      snapping: {
        ...DEFAULT_EDITOR_SETTINGS.snapping,
        ...(parsed.snapping || {})
      }
    };
  } catch (err) {
    console.warn('Failed to load editor settings, using defaults:', err);
    return DEFAULT_EDITOR_SETTINGS;
  }
}

export function saveEditorSettings(settings: EditorSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save editor settings:', err);
  }
}

export function formatDistance(meters: number, unit: DistanceUnit, precision = 3): string {
  let val = meters;
  let suffix = 'm';

  switch (unit) {
    case 'mm':
      val = meters * 1000;
      suffix = 'mm';
      break;
    case 'cm':
      val = meters * 100;
      suffix = 'cm';
      break;
    case 'ft':
      val = meters * 3.28084;
      suffix = 'ft';
      break;
    case 'in':
      val = meters * 39.3701;
      suffix = 'in';
      break;
    case 'm':
    default:
      val = meters;
      suffix = 'm';
      break;
  }

  const formatted = val.toFixed(unit === 'mm' ? Math.max(0, precision - 2) : precision);
  return `${formatted} ${suffix}`;
}
