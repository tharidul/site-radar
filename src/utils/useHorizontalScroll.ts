import { useRef, useEffect, useCallback } from 'react';

export interface HorizontalScrollState {
  hasOverflow: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  isDragging: boolean;
}

export interface UseHorizontalScrollOptions {
  onScrollStateChange?: (state: HorizontalScrollState) => void;
  dragThresholdPx?: number;
}

const DEFAULT_DRAG_THRESHOLD_PX = 5;

/**
 * Attaches horizontal mouse-wheel scrolling, mouse/pen drag-to-pan,
 * and overflow/edge scroll-state tracking to a scrollable container.
 */
export function setupHorizontalScroll(
  element: HTMLElement,
  options?: UseHorizontalScrollOptions,
): () => void {
  const dragThreshold = options?.dragThresholdPx ?? DEFAULT_DRAG_THRESHOLD_PX;
  const onStateChange = options?.onScrollStateChange;

  let isPointerDown = false;
  let hasDragged = false;
  let startX = 0;
  let startScrollLeft = 0;
  let activePointerId: number | null = null;
  let suppressClickTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressClickCleanup: (() => void) | null = null;

  // Cache layout metrics to avoid forced synchronous reflow on every scroll/mousemove
  let maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
  let lastState: HorizontalScrollState | null = null;

  const refreshMetrics = () => {
    maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
  };

  const emitScrollState = (isDraggingNow = false) => {
    const hasOverflow = maxScrollLeft > 1;
    const scrollLeft = element.scrollLeft;
    const canScrollLeft = hasOverflow && scrollLeft > 1;
    const canScrollRight = hasOverflow && scrollLeft < maxScrollLeft - 1;

    if (
      lastState &&
      lastState.hasOverflow === hasOverflow &&
      lastState.canScrollLeft === canScrollLeft &&
      lastState.canScrollRight === canScrollRight &&
      lastState.isDragging === isDraggingNow
    ) {
      return;
    }

    lastState = {
      hasOverflow,
      canScrollLeft,
      canScrollRight,
      isDragging: isDraggingNow,
    };

    element.classList.toggle('more-start', canScrollLeft);
    element.classList.toggle('more-end', canScrollRight);
    element.dataset.hasOverflow = hasOverflow ? 'true' : 'false';
    element.dataset.dragging = isDraggingNow ? 'true' : 'false';

    if (hasOverflow) {
      element.style.cursor = isDraggingNow ? 'grabbing' : 'grab';
    } else {
      element.style.cursor = '';
    }

    onStateChange?.(lastState);
  };

  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
      refreshMetrics();
      if (maxScrollLeft > 0) {
        e.preventDefault();
        element.scrollLeft += e.deltaY;
        emitScrollState(false);
      }
    }
  };

  const onScroll = () => {
    emitScrollState(hasDragged);
  };

  const clearClickSuppression = () => {
    if (suppressClickTimer !== null) {
      clearTimeout(suppressClickTimer);
      suppressClickTimer = null;
    }
    if (suppressClickCleanup) {
      suppressClickCleanup();
      suppressClickCleanup = null;
    }
  };

  const armClickSuppression = () => {
    clearClickSuppression();
    const blockClick = (clickEvent: MouseEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      clearClickSuppression();
    };
    element.addEventListener('click', blockClick, true);
    suppressClickCleanup = () => {
      element.removeEventListener('click', blockClick, true);
    };
    suppressClickTimer = setTimeout(() => {
      clearClickSuppression();
    }, 0);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isPointerDown) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    if (!hasDragged && Math.abs(dx) >= dragThreshold) {
      hasDragged = true;
      element.style.scrollBehavior = 'auto';
      emitScrollState(true);
    }

    if (hasDragged) {
      e.preventDefault();
      const clamped = Math.max(0, Math.min(maxScrollLeft, startScrollLeft - dx));
      element.scrollLeft = clamped;
      emitScrollState(true);
    }
  };

  const endDrag = (e?: PointerEvent) => {
    if (!isPointerDown) return;
    if (e && activePointerId !== null && e.pointerId !== activePointerId) return;

    const didDrag = hasDragged;
    isPointerDown = false;
    hasDragged = false;
    activePointerId = null;
    element.style.scrollBehavior = '';

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);

    if (didDrag) {
      armClickSuppression();
    }

    emitScrollState(false);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    refreshMetrics();
    if (maxScrollLeft <= 0) return;

    isPointerDown = true;
    hasDragged = false;
    startX = e.clientX;
    startScrollLeft = element.scrollLeft;
    activePointerId = e.pointerId;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  const onDragStart = (e: DragEvent) => {
    if (maxScrollLeft > 0) {
      e.preventDefault();
    }
  };

  let resizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      refreshMetrics();
      emitScrollState(hasDragged);
    });
    resizeObserver.observe(element);
  }

  const onWindowResize = () => {
    refreshMetrics();
    emitScrollState(hasDragged);
  };

  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('scroll', onScroll, { passive: true });
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('dragstart', onDragStart);
  window.addEventListener('resize', onWindowResize);

  emitScrollState(false);

  return () => {
    clearClickSuppression();
    endDrag();
    resizeObserver?.disconnect();
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('scroll', onScroll);
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('dragstart', onDragStart);
    window.removeEventListener('resize', onWindowResize);
  };
}

/**
 * Hook to enable horizontal wheel + mouse drag-and-move scrolling with
 * overflow/edge state notifications.
 */
export function useHorizontalScroll<T extends HTMLElement = HTMLDivElement>(
  options?: UseHorizontalScrollOptions,
) {
  const ref = useRef<T | null>(null);
  const onScrollStateChangeRef = useRef(options?.onScrollStateChange);
  onScrollStateChangeRef.current = options?.onScrollStateChange;

  const stableNotify = useCallback((state: HorizontalScrollState) => {
    onScrollStateChangeRef.current?.(state);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    return setupHorizontalScroll(element, {
      dragThresholdPx: options?.dragThresholdPx,
      onScrollStateChange: stableNotify,
    });
  }, [options?.dragThresholdPx, stableNotify]);

  return ref;
}
