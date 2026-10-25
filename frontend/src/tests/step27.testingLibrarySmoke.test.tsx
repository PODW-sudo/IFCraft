import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResizeHandle } from '../components/common/ResizeHandle';

/**
 * STEP-27 smoke test: proves the infrastructure works before any feature test is written.
 *
 * It exercises, in one test: JSX transform under React 19, jsdom DOM, @testing-library/react
 * queries, jest-dom matchers (loaded by src/tests/setup.ts) and user-event interactions.
 * `ResizeHandle` is real production code (frontend/src/components/common/ResizeHandle.tsx),
 * has no context dependency and no WebGL.
 */
describe('frontend test infrastructure', () => {
  it('renders a React component and reacts to a user event', async () => {
    const user = userEvent.setup();
    const onMouseDown = vi.fn();
    const onDoubleClick = vi.fn();

    render(
      <ResizeHandle
        position="left"
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
      />,
    );

    const handle = screen.getByRole('separator');
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('data-qa-position', 'left');

    await user.dblClick(handle);

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });
});
