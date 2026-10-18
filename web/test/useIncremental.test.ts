import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIncremental } from '../src/useIncremental.ts';

type Callback = (entries: { isIntersecting: boolean }[]) => void;

/** Minimal IntersectionObserver double: tests trigger intersections by hand. */
function installObserver() {
  const observers: { callback: Callback; disconnected: boolean }[] = [];
  class FakeObserver {
    entry: { callback: Callback; disconnected: boolean };
    constructor(callback: Callback) {
      this.entry = { callback, disconnected: false };
      observers.push(this.entry);
    }
    observe() {}
    disconnect() {
      this.entry.disconnected = true;
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  const active = () => observers.filter((o) => !o.disconnected).at(-1)!;
  return { intersect: (isIntersecting = true) => act(() => active().callback([{ isIntersecting }])) };
}

/** Renders the hook with a sentinel element attached, as the list does. */
function setup(total: number, key: unknown = 'a', options?: { initial: number; step: number }) {
  return renderHook(
    ({ total, key }) => {
      const result = useIncremental(total, key, options);
      result.sentinel.current ??= document.createElement('div');
      return result;
    },
    { initialProps: { total, key } },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('useIncremental', () => {
  it('renders everything when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { result } = setup(500);
    expect(result.current.visible).toBe(500);
  });

  it('starts with a first batch and grows when the sentinel comes into view', () => {
    const { intersect } = installObserver();
    const { result, rerender } = setup(250, 'a', { initial: 10, step: 100 });
    expect(result.current.visible).toBe(10);
    rerender({ total: 250, key: 'a' });
    intersect(false);
    expect(result.current.visible).toBe(10);
    intersect();
    expect(result.current.visible).toBe(110);
    intersect();
    intersect();
    expect(result.current.visible).toBe(250);
  });

  it('goes back to the first batch when the list changes', () => {
    const { intersect } = installObserver();
    const { result, rerender } = setup(250, 'a', { initial: 10, step: 100 });
    rerender({ total: 250, key: 'a' });
    intersect();
    expect(result.current.visible).toBe(110);
    rerender({ total: 40, key: 'b' });
    expect(result.current.visible).toBe(10);
  });
});
