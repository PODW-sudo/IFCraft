import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingCard } from '../components/onboarding/OnboardingCard';
import { ONBOARDING_KEY, hasCompletedOnboarding } from '../services/onboarding';

describe('STEP-28 first-run welcome card', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is a single dismissible surface with the two start actions', () => {
    const onUpload = vi.fn();
    const onOpenSample = vi.fn();
    const onDismiss = vi.fn();

    render(
      <OnboardingCard onUpload={onUpload} onOpenSample={onOpenSample} onDismiss={onDismiss} />
    );

    expect(screen.getByText('Welcome to IFC Editor')).toBeInTheDocument();
    // The duplicate "Spatial Canvas Ready" panel is the caller's responsibility; the card
    // itself exposes exactly one upload and one sample action so the empty state cannot
    // render two competing welcomes.
    fireEvent.click(screen.getByRole('button', { name: /upload ifc/i }));
    expect(onUpload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /open sample/i }));
    expect(onOpenSample).toHaveBeenCalledTimes(1);
  });

  it('dismisses in the same tick, records the flag and tells the parent', () => {
    const onDismiss = vi.fn();
    render(<OnboardingCard onUpload={vi.fn()} onOpenSample={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss getting started card/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(hasCompletedOnboarding()).toBe(true);
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1');
    expect(screen.queryByText('Welcome to IFC Editor')).not.toBeInTheDocument();
  });
});
