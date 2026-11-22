import { useState, useCallback } from 'react';

export function useFocusNavigation(totalCount, initialIndex = 0) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goNext = useCallback(() => {
    setCurrentIndex(prev => (prev < totalCount - 1 ? prev + 1 : prev));
  }, [totalCount]);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  // Keyboard navigation lives in WordCardModal, which only listens while open and
  // while its tab is active (a global listener here double-stepped and fired from hidden tabs).

  return {
    currentIndex,
    setCurrentIndex,
    goNext,
    goPrev,
    hasNext: currentIndex < totalCount - 1,
    hasPrev: currentIndex > 0
  };
}
