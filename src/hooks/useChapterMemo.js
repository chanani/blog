import { useState, useCallback } from 'react';

export function useChapterMemo(bookSlug, chapterPath) {
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMemos = useCallback(async () => {
    if (!bookSlug || !chapterPath) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/memos?book=${encodeURIComponent(bookSlug)}&chapter=${encodeURIComponent(chapterPath)}`
      );
      if (!res.ok) throw new Error('Failed to fetch memos');
      const data = await res.json();
      setMemos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bookSlug, chapterPath]);

  const addMemo = useCallback(async (selectedText, note, occurrence, adminPassword) => {
    const res = await fetch('/api/memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookSlug, chapterPath, selectedText, note, occurrence, adminPassword }),
    });
    if (!res.ok) throw new Error('Failed to add memo');
    const memo = await res.json();
    setMemos((prev) => [...prev, memo]);
    return memo;
  }, [bookSlug, chapterPath]);

  const editMemo = useCallback(async (commentId, note, adminPassword) => {
    const res = await fetch('/api/memos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, note, adminPassword }),
    });
    if (!res.ok) throw new Error('Failed to edit memo');
    const updated = await res.json();
    setMemos((prev) => prev.map((m) => (m.id === commentId ? updated : m)));
    return updated;
  }, []);

  const deleteMemo = useCallback(async (commentId, adminPassword) => {
    const res = await fetch(`/api/memos?commentId=${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword,
      },
    });
    if (!res.ok) throw new Error('Failed to delete memo');
    setMemos((prev) => prev.filter((m) => m.id !== commentId));
  }, []);

  return { memos, loading, error, fetchMemos, addMemo, editMemo, deleteMemo };
}
