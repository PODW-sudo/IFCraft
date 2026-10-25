import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlassSpatialTree } from '../components/tree/GlassSpatialTree';
import type { SpatialNode } from '../types/ifc';

function makeTree(children: number): SpatialNode {
  return {
    express_id: 1,
    global_id: 'project-guid',
    name: 'Test Project',
    type: 'IfcProject',
    children: [
      {
        express_id: 2,
        global_id: 'site-guid',
        name: 'Site',
        type: 'IfcSite',
        children: [
          {
            express_id: 3,
            global_id: 'building-guid',
            name: 'Building',
            type: 'IfcBuilding',
            children: [
              {
                express_id: 4,
                global_id: 'storey-guid',
                name: 'Level 01',
                type: 'IfcBuildingStorey',
                children: Array.from({ length: children }, (_, index) => ({
                  express_id: 1000 + index,
                  global_id: `room-${index}`,
                  name: `Room ${index}`,
                  type: 'IfcSpace',
                  children: [],
                })),
              },
            ],
          },
        ],
      },
    ],
  } as SpatialNode;
}

const props = {
  selectedExpressID: null,
  onSelectElement: vi.fn(),
  isolatedExpressID: null,
  onToggleIsolate: vi.fn(),
  isOpen: true,
  onToggleOpen: vi.fn(),
  onWidthChange: vi.fn(),
  fileName: 'Window Test',
};

describe('STEP-15 windowed spatial tree', () => {
  it('renders a bounded slice of a 600-row branch, not the whole branch', () => {
    const { container } = render(<GlassSpatialTree tree={makeTree(600)} {...props} />);

    // The initial expansion stops at the first storey; open it if the chain did not.
    if (!screen.queryByText('Room 0')) {
      const chevrons = screen.getAllByRole('button', { name: '' }).filter(
        (button) => button.getAttribute('data-qa') === 'tree-node-chevron'
      );
      fireEvent.click(chevrons[chevrons.length - 1]);
    }

    expect(screen.getByText('Room 0')).toBeInTheDocument();

    const renderedRows = container.querySelectorAll('[data-qa="tree-scroll-body"] .group');
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(60);
    expect(renderedRows.length).toBeLessThan(600 / 4);

    // The scrollbar still represents the whole branch: a far-away row is not mounted.
    expect(screen.queryByText('Room 599')).not.toBeInTheDocument();

    const scrollBody = container.querySelector('[data-qa="tree-scroll-body"]');
    expect(scrollBody).not.toBeNull();
    // Two spacers must account for the full row count at TREE_ROW_HEIGHT (32px).
    const spacers = scrollBody!.querySelectorAll('[aria-hidden="true"]');
    const spacerHeight = Array.from(spacers).reduce(
      (sum, node) => sum + parseFloat((node as HTMLElement).style.height || '0'),
      0
    );
    // Spacers + mounted rows together must still describe the full branch height.
    expect(spacerHeight + renderedRows.length * 32).toBeGreaterThanOrEqual(600 * 32);
  });
});
