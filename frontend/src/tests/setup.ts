import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setApiToken } from '../services/api';

// STEP-05 / F-003: in the browser the API token is bootstrapped once from
// `/api/bootstrap/token`. Component tests assert exact `fetch` call counts, so the token is
// primed here instead — every request still carries the `X-API-Token` header, no extra call.
setApiToken('test-api-token');

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom implements neither of these; Radix primitives (Dialog, DropdownMenu, Slider)
// call matchMedia, and Popper-based components construct a ResizeObserver.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

if (!('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}
