import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GlassPropertyInspector } from '../components/properties/GlassPropertyInspector';
import type { ElementDetails } from '../types/ifc';

const details: ElementDetails = {
  express_id: 42,
  global_id: '2O2Fr$t4X7Zf8NOew3FKau',
  name: 'Basic Wall: Party Wall',
  type: 'IfcWall',
  psets: [
    {
      name: 'Pset_WallCommon',
      properties: [{ name: 'IsExternal', value: true, value_type: 'IfcBoolean' }],
    },
  ],
  quantities: {},
};

const baseProps = {
  projectId: 'project-1',
  isOpen: true,
  onClose: () => {},
};

describe('STEP-14 controlled inspector details', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('issues zero element-detail GETs when details are provided', () => {
    render(<GlassPropertyInspector {...baseProps} expressId={42} details={details} />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Basic Wall: Party Wall')).toBeInTheDocument();
    expect(screen.getByText('Pset_WallCommon')).toBeInTheDocument();
  });

  it('never renders a different element than the one selected', () => {
    render(<GlassPropertyInspector {...baseProps} expressId={43} details={details} />);
    expect(screen.queryByText('Basic Wall: Party Wall')).not.toBeInTheDocument();
    expect(screen.getByText(/Loading metadata/)).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('shows the loading state while the caller is fetching', () => {
    render(
      <GlassPropertyInspector {...baseProps} expressId={42} details={null} detailsLoading />
    );
    expect(screen.getByText(/Loading metadata/)).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
