import { describe, it, expect, vi } from 'vitest';
import { setupHorizontalScroll, type HorizontalScrollState } from '../src/utils/useHorizontalScroll';

function makePointerEvent(
  type: string,
  init: { clientX?: number; button?: number; pointerId?: number; pointerType?: string } = {},
): Event {
  const evt = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    clientX: number;
    button: number;
    pointerId: number;
    pointerType: string;
  };
  evt.clientX = init.clientX ?? 0;
  evt.button = init.button ?? 0;
  evt.pointerId = init.pointerId ?? 1;
  evt.pointerType = init.pointerType ?? 'mouse';
  return evt;
}

describe('Horizontal Scroll & Mouse Drag-to-Move Behavior', () => {
  it('translates vertical wheel deltaY into horizontal scrollLeft when overflow exists', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientWidth', { value: 350, configurable: true });
    container.scrollLeft = 0;

    const states: HorizontalScrollState[] = [];
    const cleanup = setupHorizontalScroll(container, {
      onScrollStateChange: (s) => states.push(s),
    });

    expect(states[0]).toEqual({
      hasOverflow: true,
      canScrollLeft: false,
      canScrollRight: true,
      isDragging: false,
    });

    const event = new WheelEvent('wheel', {
      deltaY: 120,
      deltaX: 0,
      cancelable: true,
    });
    container.dispatchEvent(event);

    expect(container.scrollLeft).toBe(120);
    expect(event.defaultPrevented).toBe(true);
    expect(states[states.length - 1]).toEqual({
      hasOverflow: true,
      canScrollLeft: true,
      canScrollRight: true,
      isDragging: false,
    });

    cleanup();
  });

  it('does not prevent default or modify scrollLeft when no horizontal overflow', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollWidth', { value: 300, configurable: true });
    Object.defineProperty(container, 'clientWidth', { value: 300, configurable: true });
    container.scrollLeft = 0;

    const states: HorizontalScrollState[] = [];
    const cleanup = setupHorizontalScroll(container, {
      onScrollStateChange: (s) => states.push(s),
    });

    expect(states[0]?.hasOverflow).toBe(false);
    expect(container.style.cursor).toBe('');

    const event = new WheelEvent('wheel', {
      deltaY: 100,
      deltaX: 0,
      cancelable: true,
    });
    container.dispatchEvent(event);

    expect(container.scrollLeft).toBe(0);
    expect(event.defaultPrevented).toBe(false);

    cleanup();
  });

  it('pans horizontally on mouse drag-and-move and suppresses accidental click after dragging', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    const onTabClick = vi.fn();
    button.addEventListener('click', onTabClick);
    container.appendChild(button);

    Object.defineProperty(container, 'scrollWidth', { value: 700, configurable: true });
    Object.defineProperty(container, 'clientWidth', { value: 350, configurable: true });
    container.scrollLeft = 40;

    const cleanup = setupHorizontalScroll(container);

    expect(container.style.cursor).toBe('grab');

    // Start mouse press and drag left by 60px (scrollLeft increases by 60 -> 100)
    button.dispatchEvent(makePointerEvent('pointerdown', { clientX: 200, button: 0, pointerId: 1 }));
    window.dispatchEvent(makePointerEvent('pointermove', { clientX: 140, pointerId: 1 }));

    expect(container.scrollLeft).toBe(100);
    expect(container.dataset.dragging).toBe('true');
    expect(container.style.cursor).toBe('grabbing');

    window.dispatchEvent(makePointerEvent('pointerup', { clientX: 140, pointerId: 1 }));
    expect(container.dataset.dragging).toBe('false');
    expect(container.style.cursor).toBe('grab');

    // The synthetic click immediately following a drag is suppressed so tab isn't switched
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onTabClick).not.toHaveBeenCalled();

    cleanup();
  });

  it('allows normal button click when pointer movement stays within drag threshold', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    const onTabClick = vi.fn();
    button.addEventListener('click', onTabClick);
    container.appendChild(button);

    Object.defineProperty(container, 'scrollWidth', { value: 700, configurable: true });
    Object.defineProperty(container, 'clientWidth', { value: 350, configurable: true });
    container.scrollLeft = 0;

    const cleanup = setupHorizontalScroll(container);

    button.dispatchEvent(makePointerEvent('pointerdown', { clientX: 100, button: 0, pointerId: 1 }));
    window.dispatchEvent(makePointerEvent('pointermove', { clientX: 98, pointerId: 1 }));
    window.dispatchEvent(makePointerEvent('pointerup', { clientX: 98, pointerId: 1 }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(container.scrollLeft).toBe(0);
    expect(onTabClick).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
