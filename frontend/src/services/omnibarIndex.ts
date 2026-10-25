/**
 * STEP-28 / F-051 (omnibar half) - the command palette index.
 *
 * `SpatialOmnibar` used to build its list inline and cap it twice (`geometries.slice(0, 50)`
 * and `.slice(0, 15)` on the filtered list), so element #249 of a 250-element model was
 * simply unreachable and the UI said nothing about it. Indexing is now a pure function:
 * one item per geometry, filtering returns **all** matches, and the component renders the
 * first `MAX_VISIBLE_RESULTS` plus a labelled "+N more" footer.
 *
 * Pure on purpose - no React, no icons. Items carry an `iconKey` that the component maps
 * to a lucide icon, so this module stays unit-testable.
 */

import { UI_STYLE_OPTIONS, type UiStyleMode } from '../types/settings';

/** How many matches the palette renders before it has to say "+N more". */
export const MAX_VISIBLE_RESULTS = 50;

export type OmnibarCategory = 'element' | 'spatial' | 'tool' | 'style';

/** Minimal geometry shape - `GeometryData` satisfies it structurally. */
export interface OmnibarGeometryLike {
  expressID: number;
  type: string;
}

/** Minimal spatial-node shape - `SpatialNode` satisfies it structurally. */
export interface OmnibarSpatialNodeLike {
  express_id: number;
  name: string;
  type: string;
}

export interface OmnibarItem {
  id: string;
  title: string;
  subtitle: string;
  category: OmnibarCategory;
  /** Resolved to a lucide icon by `SpatialOmnibar`. */
  iconKey: string;
  action: () => void;
}

export interface OmnibarCallbacks {
  onSelectElement: (expressID: number) => void;
  onTriggerTool: (toolId: string) => void;
  onUpdateUiStyleMode?: (mode: UiStyleMode) => void;
}

export interface BuildOmnibarItemsArgs<TGeometry extends OmnibarGeometryLike, TSpatial extends OmnibarSpatialNodeLike> {
  geometries: readonly TGeometry[];
  spatialNodes: readonly TSpatial[];
  callbacks: OmnibarCallbacks;
}

const TOOL_ITEMS: ReadonlyArray<{
  id: string;
  title: string;
  subtitle: string;
  iconKey: string;
  toolId: string;
}> = [
  {
    id: 'tool-measure',
    title: 'Measure Tool',
    subtitle: 'Point-to-point 3D laser measurement',
    iconKey: 'measure',
    toolId: 'measure'
  },
  {
    id: 'tool-section',
    title: 'Section Cut',
    subtitle: 'Toggle orthogonal clipping plane (X/Y/Z)',
    iconKey: 'section',
    toolId: 'section'
  },
  {
    id: 'tool-grid',
    title: 'Toggle 3D Ground Grid',
    subtitle: 'Show or hide infinite radial ground grid (G)',
    iconKey: 'grid',
    toolId: 'grid'
  },
  {
    id: 'tool-sheets',
    title: 'Drawing Sheets & Views Composer',
    subtitle: 'Assemble 2D plans, sections, and scaled title block sheets (Shift+S)',
    iconKey: 'sheets',
    toolId: 'sheets'
  },
  {
    id: 'tool-copilot',
    title: 'AI BIM Copilot',
    subtitle: 'Natural language building queries & edits',
    iconKey: 'copilot',
    toolId: 'copilot'
  },
  {
    id: 'tool-export',
    title: 'Export IFC Model',
    subtitle: 'Download updated .ifc geometry and attributes',
    iconKey: 'export',
    toolId: 'export'
  }
];

/**
 * One item per tool, spatial container and geometry - **no element cap** (spec 7.1).
 * UI style entries are appended only when a style callback is supplied.
 */
export function buildOmnibarItems<TGeometry extends OmnibarGeometryLike, TSpatial extends OmnibarSpatialNodeLike>({
  geometries,
  spatialNodes,
  callbacks
}: BuildOmnibarItemsArgs<TGeometry, TSpatial>): OmnibarItem[] {
  const items: OmnibarItem[] = [];

  for (const tool of TOOL_ITEMS) {
    items.push({
      id: tool.id,
      title: tool.title,
      subtitle: tool.subtitle,
      category: 'tool',
      iconKey: tool.iconKey,
      action: () => callbacks.onTriggerTool(tool.toolId)
    });
  }

  for (const node of spatialNodes) {
    items.push({
      id: `spatial-${node.express_id}`,
      title: node.name || node.type,
      subtitle: `Spatial Container (${node.type}) #${node.express_id}`,
      category: 'spatial',
      iconKey: node.type.includes('Storey') ? 'storey' : 'spatial',
      action: () => callbacks.onSelectElement(node.express_id)
    });
  }

  for (const geometry of geometries) {
    items.push({
      id: `element-${geometry.expressID}`,
      title: `Element #${geometry.expressID}`,
      subtitle: `${geometry.type} | Category Geometry`,
      category: 'element',
      iconKey: 'element',
      action: () => callbacks.onSelectElement(geometry.expressID)
    });
  }

  if (callbacks.onUpdateUiStyleMode) {
    const applyStyle = callbacks.onUpdateUiStyleMode;
    for (const style of UI_STYLE_OPTIONS) {
      items.push({
        id: `style-${style.id}`,
        title: `UI Style: ${style.name}`,
        subtitle: `${style.badge ?? 'Style'} | ${style.description}`,
        category: 'style',
        iconKey: 'style',
        action: () => applyStyle(style.id)
      });
    }
  }

  return items;
}

/**
 * Case-insensitive match on title **or** subtitle, returning every hit (spec 7.2).
 * An empty query returns the whole index.
 */
export function filterOmnibarItems(items: readonly OmnibarItem[], query: string): OmnibarItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items as OmnibarItem[];
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(needle) || item.subtitle.toLowerCase().includes(needle)
  );
}
