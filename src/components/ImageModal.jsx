import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './ImageModal.css';

function ImageModal({ images, index, onClose, onNavigate }) {
  const touchRef = useRef(null);
  const isOpen = images && images.length > 0 && index >= 0;
  const current = isOpen ? images[index] : null;
  const hasPrev = index > 0;
  const hasNext = index < (images?.length ?? 0) - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(index - 1);
  }, [hasPrev, index, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(index + 1);
  }, [hasNext, index, onNavigate]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goPrev, goNext]);

  const handleTouchStart = (e) => {
    touchRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchRef.current === null) return;
    const diff = touchRef.current - e.changedTouches[0].clientX;
    touchRef.current = null;
    if (diff > 50) goNext();
    if (diff < -50) goPrev();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="image-modal-overlay"
          onClick={onClose}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {hasPrev && (
            <button
              className="image-modal-arrow prev"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              aria-label="이전 이미지"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <AnimatePresence mode="wait">
            <motion.img
              key={current.src}
              src={current.src}
              alt={current.alt || ''}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.15 }}
            />
          </AnimatePresence>

          {hasNext && (
            <button
              className="image-modal-arrow next"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              aria-label="다음 이미지"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {images.length > 1 && (
            <span className="image-modal-counter">
              {index + 1} / {images.length}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ImageModal;
