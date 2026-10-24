import { type RefObject, useEffect, useRef } from 'react';

/**
 * A closing dialog returns focus to the button that opened it, unless an
 * action in the dialog removed that button. Focus would then drop to the page
 * body and the next Tab would start from the top, so it moves to `fallbackRef`
 * instead.
 */
export const useFocusFallback = (
  isOpen: boolean,
  fallbackRef: RefObject<HTMLElement | null>,
) => {
  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    // The closed dialog's cleanup has already tried its opener by now.
    if (
      wasOpenRef.current &&
      !isOpen &&
      document.activeElement === document.body
    ) {
      fallbackRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, fallbackRef]);
};
