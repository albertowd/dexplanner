import { useEffect, type RefObject } from 'react';

/** Closes a `<details>` dropdown like a native select: on Escape, or when clicking or focusing outside it. */
export function useDismissable(ref: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const closeOutside = (e: Event) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      const el = ref.current;
      if (e.key === 'Escape' && el?.open && el.contains(document.activeElement)) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [ref]);
}

/** Closes the dropdown that contains `el` (after picking an option). */
export function closeDropdown(el: HTMLElement) {
  const details = el.closest('details');
  if (details) details.open = false;
}
