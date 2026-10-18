import { useEffect, useRef, useState } from 'react';

/**
 * Renders a long list in batches: `initial` items first, then `step` more whenever the returned
 * sentinel element scrolls near the viewport. Without IntersectionObserver everything renders at once.
 * The count resets when `resetKey` changes (e.g. a new filter).
 */
export function useIncremental(total: number, resetKey: unknown, { initial = 48, step = 96 } = {}) {
  const supported = typeof IntersectionObserver !== 'undefined';
  const [count, setCount] = useState(supported ? initial : Infinity);
  const sentinel = useRef<HTMLDivElement>(null);

  // Start from the first batch again when the list itself changes.
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    if (supported) setCount(initial);
  }

  useEffect(() => {
    const el = sentinel.current;
    if (!supported || !el || count >= total) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((c) => c + step);
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [supported, count, total, step]);

  return { visible: Math.min(count, total), sentinel };
}
