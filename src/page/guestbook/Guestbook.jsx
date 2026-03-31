import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import Giscus from '@giscus/react';
import './Guestbook.css';

const CARD_COLORS = [
  'card-yellow',
  'card-blue',
  'card-green',
  'card-pink',
  'card-purple',
  'card-orange',
];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function GuestbookCard({ entry, colorClass }) {
  return (
    <motion.div
      className={`gb-card ${colorClass}`}
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
  const [error, setError] = useState('');
  const [giscusTheme, setGiscusTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light',
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const t = document.documentElement.getAttribute('data-theme') || 'light';
      setGiscusTheme(t);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
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
        {/* Giscus — write form only (comment list hidden via CSS) */}
        <div className="gb-write-section">
          <Giscus
            repo="chanani/blog"
            repoId="R_kgDORI3Ksw"
            category="Announcements"
            categoryId="DIC_kwDORI3Ks84C15da"
            mapping="specific"
            term="guestbook"
            reactionsEnabled="0"
            emitMetadata="0"
            inputPosition="top"
            theme={import.meta.env.DEV
              ? (giscusTheme === 'dark' ? 'dark_dimmed' : 'light')
              : `https://chanhan.blog/giscus-${giscusTheme}.css?v=7`}
            lang="ko"
          />
        </div>

        {/* Custom card grid */}
        {loading && <p className="gb-status">불러오는 중...</p>}
        {error && <p className="gb-status gb-status-error">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="gb-status">아직 남긴 글이 없습니다.</p>
        )}
        {!loading && entries.length > 0 && (
          <div className="gb-grid">
            {entries.map((entry, i) => (
              <GuestbookCard
                key={entry.id}
                entry={entry}
                colorClass={CARD_COLORS[i % CARD_COLORS.length]}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default Guestbook;
