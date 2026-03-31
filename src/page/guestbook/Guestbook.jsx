import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import './Guestbook.css';

const COLOR_OPTIONS = [
  { id: 'yellow',  hex: '#fef9c3' },
  { id: 'blue',    hex: '#dbeafe' },
  { id: 'green',   hex: '#dcfce7' },
  { id: 'pink',    hex: '#fce7f3' },
  { id: 'purple',  hex: '#ede9fe' },
  { id: 'orange',  hex: '#ffedd5' },
];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function GuestbookCard({ entry }) {
  return (
    <motion.div
      className="gb-card"
      style={{ background: COLOR_OPTIONS.find((c) => c.id === entry.color)?.hex || '#fef9c3' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <p className="gb-card-message">{entry.message}</p>
      <div className="gb-card-footer">
        <div className="gb-card-author">
          {entry.avatar && (
            <img className="gb-card-avatar" src={entry.avatar} alt={entry.nickname} />
          )}
          <span className="gb-card-nickname">{entry.nickname}</span>
        </div>
        <span className="gb-card-date">{formatDate(entry.createdAt)}</span>
      </div>
    </motion.div>
  );
}

function Guestbook() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/guestbook');
      if (!r.ok) throw new Error();
      const data = await r.json();
      setEntries(data.entries || []);
    } catch {
      setError('방명록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!nickname.trim()) return setFormError('닉네임을 입력해주세요.');
    if (!message.trim()) return setFormError('내용을 입력해주세요.');
    if (message.trim().length > 500) return setFormError('내용은 500자 이하로 입력해주세요.');

    setSubmitting(true);
    try {
      const r = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), message: message.trim(), color: selectedColor }),
      });
      const data = await r.json();
      if (!r.ok) return setFormError(data.error || '저장에 실패했습니다.');
      setEntries((prev) => [data, ...prev]);
      setNickname('');
      setMessage('');
      setSelectedColor('yellow');
    } catch {
      setFormError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="guestbook-page">
      <Helmet>
        <title>guestbook — chanani.</title>
        <meta name="description" content="chanani의 방명록입니다. 자유롭게 글을 남겨주세요." />
        <link rel="canonical" href="https://chanhan.blog/guestbook" />
      </Helmet>

      <div className="guestbook-header">
        <div className="guestbook-header-inner">
          <h1 className="guestbook-title">Guestbook</h1>
          <p className="guestbook-desc">남기고 싶은 말이 있다면 편하게 남겨주세요.</p>
        </div>
      </div>

      <div className="guestbook-body">
        {/* Write form */}
        <form className="gb-form" onSubmit={handleSubmit}>
          <div className="gb-form-top">
            <input
              className="gb-input"
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              disabled={submitting}
            />
            <div className="gb-color-picker">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`gb-color-swatch${selectedColor === c.id ? ' selected' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => setSelectedColor(c.id)}
                  aria-label={c.id}
                />
              ))}
            </div>
            <button className="gb-submit-btn" type="submit" disabled={submitting}>
              {submitting ? '저장 중...' : '남기기'}
            </button>
          </div>
          <textarea
            className="gb-textarea"
            placeholder="자유롭게 글을 남겨주세요. (최대 500자)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={submitting}
          />
          {formError && <p className="gb-form-error">{formError}</p>}
        </form>

        {/* Entries */}
        {loading && <p className="gb-status">불러오는 중...</p>}
        {error && <p className="gb-status gb-status-error">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="gb-status">아직 남긴 글이 없습니다. 첫 번째 글을 남겨보세요!</p>
        )}
        {!loading && entries.length > 0 && (
          <div className="gb-grid">
            {entries.map((entry) => (
              <GuestbookCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default Guestbook;
