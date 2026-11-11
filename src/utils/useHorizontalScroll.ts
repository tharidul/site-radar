import { useRef, useEffect } from 'react';

/**
 * Hook to enable horizontal scrolling via standard vertical mouse wheel events
 */
export function useHorizontalScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const onWheel = (e: WheelEvent) => {
      // If the event has a dominant vertical delta (standard mouse wheel)
      // and the element has horizontal overflow
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
        if (element.scrollWidth > element.clientWidth) {
          e.preventDefault();
          element.scrollLeft += e.deltaY;
        }
      }
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', onWheel);
    };
  }, []);

  return ref;
}

