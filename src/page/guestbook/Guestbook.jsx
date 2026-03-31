import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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

function getGbUser() {
  try {
    const match = document.cookie.match(/(?:^|;\s*)gb_user=([^;]*)/);
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match[1]));
  } catch { return null; }
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function GuestbookCard({ entry }) {
  const bg = COLOR_OPTIONS.find((c) => c.id === entry.color)?.hex || '#fef9c3';
  return (
    <motion.div
      className="gb-card"
      style={{ background: bg }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <p className="gb-card-message">{entry.message}</p>
      <div className="gb-card-footer">
        <div className="gb-card-author">
          {entry.avatar && <img className="gb-card-avatar" src={entry.avatar} alt={entry.nickname} />}
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
  const [message, setMessage] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');
  const [user, setUser] = useState(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setUser(getGbUser());
    if (searchParams.get('auth') === 'fail') setFormError('로그인에 실패했습니다. 다시 시도해주세요.');
  }, []);

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
    if (!message.trim()) return setFormError('내용을 입력해주세요.');
    if (message.trim().length > 500) return setFormError('내용은 500자 이하로 입력해주세요.');

    setSubmitting(true);
    try {
      const r = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), color: selectedColor }),
      });
      const data = await r.json();
      if (r.status === 401) {
        setUser(null);
        return setFormError('로그인이 필요합니다.');
      }
      if (!r.ok) return setFormError(data.error || '저장에 실패했습니다.');
      setEntries((prev) => [data, ...prev]);
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
        {/* Write section */}
        {user ? (
          <form className="gb-form" onSubmit={handleSubmit}>
            <div className="gb-form-top">
              <div className="gb-user-info">
                <img className="gb-user-avatar" src={user.avatar} alt={user.login} />
                <span className="gb-user-login">{user.login}</span>
              </div>
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
              <button type="button" className="gb-logout-btn" onClick={() => { window.location.href = '/api/oauth/logout'; }}>
                로그아웃
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
            <div className="gb-form-bottom">
              {formError && <p className="gb-form-error">{formError}</p>}
              <button className="gb-submit-btn" type="submit" disabled={submitting}>
                {submitting ? '저장 중...' : '남기기'}
              </button>
            </div>
          </form>
        ) : (
          <div className="gb-login-box">
            {formError && <p className="gb-form-error" style={{ marginBottom: '12px' }}>{formError}</p>}
            <a className="gb-github-btn" href="/api/oauth/authorize">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub으로 로그인
            </a>
            <p className="gb-login-desc">GitHub 계정으로 로그인하면 방명록을 남길 수 있습니다.</p>
          </div>
        )}

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
