import { useState, useEffect, useCallback } from 'react';

export function useFocusNavigation(totalCount, initialIndex = 0) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goNext = useCallback(() => {
    setCurrentIndex(prev => (prev < totalCount - 1 ? prev + 1 : prev));
  }, [totalCount]);

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle arrow keys
      if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  return {
    currentIndex,
    setCurrentIndex,
    goNext,
    goPrev,
    hasNext: currentIndex < totalCount - 1,
    hasPrev: currentIndex > 0
  };
}
