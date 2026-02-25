import { useEffect, useRef, RefObject } from 'react';

/**
 * Enables horizontal drag-to-scroll on desktop (mouse only).
 * Does NOT interfere with touch scrolling on mobile.
 */
export function useHorizontalDragScroll<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onPointerDown = (e: PointerEvent) => {
      // Only activate for mouse, not touch
      if (e.pointerType !== 'mouse') return;
      // Don't hijack clicks on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, select, textarea, [data-rfd-draggable-id]')) return;

      isDown = true;
      startX = e.clientX;
      scrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const deltaX = e.clientX - startX;
      el.scrollLeft = scrollLeft - deltaX;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = '';
      el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return ref;
}
