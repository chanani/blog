import { useState, useCallback } from 'react';

export function useHighlight(bookSlug, chapterPath) {
  const key = `highlights_${bookSlug}_${chapterPath}`;

  const [highlights, setHighlights] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  });

  const addHighlight = useCallback((text) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setHighlights((prev) => {
      const next = [...prev, { id, text }];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  const removeHighlight = useCallback((id) => {
    setHighlights((prev) => {
      const next = prev.filter((h) => h.id !== id);
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  return { highlights, addHighlight, removeHighlight };
}
