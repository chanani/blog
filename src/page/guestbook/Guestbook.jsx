import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import './Guestbook.css';

const COLOR_OPTIONS = [
  { id: 'white',  hex: '#f8fafc' },
  { id: 'yellow', hex: '#fef9c3' },
  { id: 'green',  hex: '#dcfce7' },
  { id: 'blue',   hex: '#dbeafe' },
  { id: 'pink',   hex: '#fce7f3' },
  { id: 'purple', hex: '#ede9fe' },
  { id: 'orange', hex: '#ffedd5' },
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

function GuestbookCard({ entry, user, onDelete, t }) {
  const bg = COLOR_OPTIONS.find((c) => c.id === entry.color)?.hex || '#dcfce7';
  const isOwner = user && user.login === entry.nickname;

  async function handleDelete() {
    if (!window.confirm(t('guestbook.deleteConfirm'))) return;
    try {
      const r = await fetch(`/api/guestbook?id=${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
      if (r.ok) onDelete(entry.id);
    } catch { /* ignore */ }
  }

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
          {entry.emoji
            ? <span className="gb-card-emoji">{entry.emoji}</span>
            : entry.avatar && <img className="gb-card-avatar" src={entry.avatar} alt={entry.nickname} />
          }
          <span className="gb-card-nickname">{entry.nickname}</span>
        </div>
        <div className="gb-card-footer-right">
          <span className="gb-card-date">{formatDate(entry.createdAt)}</span>
          {isOwner && (
            <button className="gb-card-delete-btn" onClick={handleDelete} aria-label="delete">✕</button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Guestbook() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedColor, setSelectedColor] = useState('green');
  const [nickname, setNickname] = useState('');
  const [user, setUser] = useState(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const u = getGbUser();
    setUser(u);
    if (u) setNickname(u.login);
    if (searchParams.get('auth') === 'fail') setFormError(t('guestbook.loginFailed'));
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
      setError(t('guestbook.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!user) return setFormError(t('guestbook.loginRequired'));
    if (!message.trim()) return setFormError(t('guestbook.emptyMessage'));
    if (message.trim().length > 500) return setFormError(t('guestbook.tooLong'));

    setSubmitting(true);
    try {
      const r = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          color: selectedColor,
          nickname: nickname.trim() || user.login,
        }),
      });
      const data = await r.json();
      if (r.status === 401) {
        setUser(null);
        return setFormError(t('guestbook.loginRequired'));
      }
      if (!r.ok) return setFormError(data.error || t('guestbook.saveFailed'));
      setEntries((prev) => [data, ...prev]);
      setMessage('');
    } catch {
      setFormError(t('guestbook.networkError'));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedBg = COLOR_OPTIONS.find((c) => c.id === selectedColor)?.hex;

  return (
    <main className="guestbook-page">
      <Helmet>
        <title>guestbook — chanani</title>
        <meta name="description" content="chanani의 방명록입니다. 자유롭게 글을 남겨주세요." />
        <link rel="canonical" href="https://chanhan.blog/guestbook" />
      </Helmet>

      <div className="guestbook-body">
        {user ? (
          <form className="gb-form" onSubmit={handleSubmit}>
            {/* Color picker */}
            <div className="gb-color-row">
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

            {/* Message */}
            <textarea
              className="gb-textarea"
              placeholder={t('guestbook.placeholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={submitting}
              style={{ background: selectedBg }}
            />

            {/* Bottom */}
            <div className="gb-form-bottom">
              {formError && <p className="gb-form-error">{formError}</p>}
              <button
                type="button"
                className="gb-logout-btn"
                onClick={() => { window.location.href = '/api/oauth/logout'; }}
              >
                {t('guestbook.logout')}
              </button>
              <button className="gb-submit-btn" type="submit" disabled={submitting}>
                {submitting ? t('guestbook.submitting') : t('guestbook.post')}
              </button>
            </div>
          </form>
        ) : (
          <div className="gb-login-box">
            {formError && <p className="gb-form-error" style={{ marginBottom: '12px' }}>{formError}</p>}
            <p className="gb-login-desc">{t('guestbook.loginDesc')}</p>
            <div className="gb-login-btns">
              <a className="gb-oauth-icon-btn gb-google-icon" href="/api/oauth/google-authorize" title="Google">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t('guestbook.googleLogin')}
              </a>
              <a className="gb-oauth-icon-btn gb-github-icon" href="/api/oauth/authorize" title="GitHub">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                {t('guestbook.githubLogin')}
              </a>
            </div>
          </div>
        )}

        {/* Entries */}
        {loading && (
          <div className="gb-status">
            <span className="loading-dots">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </span>
          </div>
        )}
        {error && <p className="gb-status gb-status-error">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="gb-status">{t('guestbook.empty')}</p>
        )}
        {!loading && entries.length > 0 && (
          <div className="gb-grid">
            {entries.map((entry) => (
              <GuestbookCard
                key={entry.id}
                entry={entry}
                user={user}
                onDelete={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default Guestbook;
