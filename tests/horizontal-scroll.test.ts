import { describe, it, expect, vi } from 'vitest';

describe('Horizontal Mouse Wheel Scroll Behavior', () => {
  it('translates vertical wheel deltaY into horizontal scrollLeft when overflow exists', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientWidth', { value: 350, configurable: true });
    container.scrollLeft = 0;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
        if (container.scrollWidth > container.clientWidth) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });

    // Simulate vertical mouse wheel scroll
    const event = new WheelEvent('wheel', {
      deltaY: 120,
      deltaX: 0,
      cancelable: true,
    });

    container.dispatchEvent(event);

    expect(container.scrollLeft).toBe(120);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not prevent default or modify scrollLeft when no horizontal overflow', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollWidth', { value: 300, configurable: true });
    Object.defineProperty(container, 'clientWidth', { value: 300, configurable: true });
    container.scrollLeft = 0;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
        if (container.scrollWidth > container.clientWidth) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });

    const event = new WheelEvent('wheel', {
      deltaY: 100,
      deltaX: 0,
      cancelable: true,
    });

    container.dispatchEvent(event);

    expect(container.scrollLeft).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });
});
