import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { FiBookOpen, FiCheck, FiClock, FiCalendar, FiXCircle, FiChevronRight, FiGrid, FiList, FiX, FiTrash2 } from 'react-icons/fi';
import useBookStore from '../../store/useBookStore';
import { useLang } from '../../hooks/useLang';
import { useTranslation } from 'react-i18next';
import BookCard from '../home/_components/BookCard';
import './Reading.css';

function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  if (weeks < 5) return `${weeks}주 전`;
  return `${months}개월 전`;
}

function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    prevTarget.current = target;

    if (target === 0) {
      setValue(0);
      return;
    }

    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (target - start) * eased));

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

function StatCard({ item, count, active, onClick }) {
  const Icon = item.icon;
  const displayCount = useCountUp(count);
  const { t } = useTranslation();

  return (
    <button
      className={`stat-card stat-${item.key}${active ? ' active' : ''}`}
      onClick={onClick}
    >
      <div className="stat-icon-wrap">
        <Icon size={16} />
      </div>
      <span className="stat-count">{displayCount}</span>
      <span className="stat-label">{t(item.labelKey)}</span>
    </button>
  );
}

function GridBookCard({ book }) {
  const [imgError, setImgError] = useState(false);
  const lang = useLang();

  return (
    <Link to={`/${lang}/book/${book.slug}`} className="grid-book-card">
      <div className="grid-cover-wrap">
        {book.cover && !imgError ? (
          <img
            src={book.cover}
            alt={book.title}
            className="grid-cover-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="grid-cover-fallback">
            <span>&#128214;</span>
          </div>
        )}
        {book.status && (
          <span className={`grid-status-badge status-${book.status}`}>
            {book.status}
          </span>
        )}
      </div>
      <div className="grid-book-info">
        <h3 className="grid-book-title">{book.title}</h3>
        {book.author && <span className="grid-book-author">{book.author}</span>}
      </div>
    </Link>
  );
}

const STAT_ITEMS = [
  { key: 'all', labelKey: 'reading.all', icon: FiBookOpen },
  { key: '완독', labelKey: 'reading.completed', icon: FiCheck },
  { key: '독서중', labelKey: 'reading.inProgress', icon: FiBookOpen },
  { key: '예정', labelKey: 'reading.planned', icon: FiCalendar },
];

const STATUS_TABS = [
  { key: 'all', labelKey: 'reading.all' },
  { key: '완독', labelKey: 'reading.completed' },
  { key: '독서중', labelKey: 'reading.inProgress' },
  { key: '예정', labelKey: 'reading.planned' },
  { key: '중단', labelKey: 'reading.stopped' },
];

function SkeletonLoading() {
  return (
    <div className="reading-content">
      <div className="stats-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-stat-card">
            <div className="skeleton-circle" />
            <div className="skeleton-line skeleton-count" />
            <div className="skeleton-line skeleton-label" />
          </div>
        ))}
      </div>

      <div className="skeleton-card">
        <div className="skeleton-card-header">
          <div className="skeleton-line skeleton-title" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-item">
            <div className="skeleton-circle skeleton-rank" />
            <div className="skeleton-item-info">
              <div className="skeleton-line skeleton-short" />
              <div className="skeleton-line skeleton-long" />
              <div className="skeleton-line skeleton-bar" />
            </div>
          </div>
        ))}
      </div>

      <div className="skeleton-card">
        <div className="skeleton-card-header">
          <div className="skeleton-line skeleton-title" />
        </div>
        <div className="skeleton-tabs">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-tab" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-book-item">
            <div className="skeleton-book-cover" />
            <div className="skeleton-item-info">
              <div className="skeleton-line skeleton-long" />
              <div className="skeleton-line skeleton-short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reading() {
  const { books, loading, loadBooks } = useBookStore();
  const lang = useLang();
  const { t } = useTranslation();
  const [readingHistory, setReadingHistory] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');

  useEffect(() => {
    loadBooks();
    const history = JSON.parse(localStorage.getItem('reading-history') || '[]');
    setReadingHistory(history);
  }, [loadBooks]);

  const statusCounts = useMemo(() => {
    const counts = { all: books.length, '완독': 0, '독서중': 0, '예정': 0, '중단': 0 };
    books.forEach((book) => {
      if (book.status && counts[book.status] !== undefined) {
        counts[book.status] += 1;
      }
    });
    return counts;
  }, [books]);

  const removeHistoryItem = (bookSlug, chapterPath) => {
    const updated = readingHistory.filter(
      (h) => !(h.bookSlug === bookSlug && h.chapterPath === chapterPath)
    );
    setReadingHistory(updated);
    localStorage.setItem('reading-history', JSON.stringify(updated));
  };

  const clearAllHistory = () => {
    setReadingHistory([]);
    localStorage.removeItem('reading-history');
  };

  const filteredBooks = useMemo(() => {
    if (statusFilter === 'all') return books;
    return books.filter((book) => book.status === statusFilter);
  }, [books, statusFilter]);

  if (loading && books.length === 0) {
    return (
      <main className="reading-page">
        <SkeletonLoading />
      </main>
    );
  }

  return (
    <main className="reading-page">
      <Helmet>
        <title>독서 현황 - 차나니의 블로그</title>
        <meta name="description" content="차나니의 독서 현황 대시보드 - 완독, 독서중, 예정 도서 현황을 한눈에 확인하세요." />
        <meta property="og:title" content="독서 현황 - 차나니의 블로그" />
        <meta property="og:description" content="차나니의 독서 현황 대시보드" />
        <link rel="canonical" href="https://chanhan.blog/books/reading" />
      </Helmet>

      <div className="reading-content">
        {/* Stats Cards */}
        <motion.div
          className="stats-grid"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {STAT_ITEMS.map((item) => (
            <StatCard
              key={item.key}
              item={item}
              count={statusCounts[item.key] || 0}
              active={statusFilter === item.key}
              onClick={() => setStatusFilter(item.key)}
            />
          ))}
        </motion.div>

        {/* Recent Reading History */}
        <motion.section
          className="recent-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <div className="card-header">
            <h2 className="card-title">
              <FiClock size={15} />
              {t('reading.recentHistory')}
            </h2>
            {readingHistory.length > 0 && (
              <button className="clear-all-btn" onClick={clearAllHistory}>
                <FiTrash2 size={13} />
                {t('reading.clearAll')}
              </button>
            )}
          </div>
          {readingHistory.length === 0 && (
            <div className="recent-empty">
              <FiBookOpen size={24} className="empty-icon" />
              <p>{t('reading.empty')}</p>
            </div>
          )}
          {readingHistory.length > 0 && (
            <div className="recent-list">
              {readingHistory.map((item, idx) => (
                <div
                  key={`${item.bookSlug}-${item.chapterPath}`}
                  className="recent-item-wrap"
                >
                  <Link
                    to={`/${lang}/book/${item.bookSlug}/read/${item.chapterPath}`}
                    className="recent-item"
                  >
                    <span className="recent-rank">{idx + 1}</span>
                    <div className="recent-info">
                      <span className="recent-book">{item.bookTitle}</span>
                      <span className="recent-chapter">{item.chapterTitle}</span>
                      <div className="recent-progress-row">
                        <div className="recent-progress-bar">
                          <div
                            className={`recent-progress-fill${item.progress >= 100 ? ' complete' : ''}`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className={`recent-progress-text${item.progress >= 100 ? ' complete' : ''}`}>
                          {item.progress >= 100 ? '완독' : `${item.progress}%`}
                        </span>
                        <span className="recent-time">{formatRelativeTime(item.timestamp)}</span>
                      </div>
                    </div>
                    <FiChevronRight size={16} className="recent-arrow" />
                  </Link>
                  <button
                    className="recent-remove"
                    onClick={() => removeHistoryItem(item.bookSlug, item.chapterPath)}
                    aria-label="기록 삭제"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Status-filtered Book List */}
        <motion.section
          className="books-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <div className="card-header">
            <h2 className="card-title">
              <FiBookOpen size={15} />
              {t('reading.booksByStatus')}
            </h2>
            <div className="card-header-right">
              <span className="card-count">{filteredBooks.length}</span>
              <div className="view-toggle">
                <button
                  className={`view-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-label="리스트 뷰"
                >
                  <FiList size={14} />
                </button>
                <button
                  className={`view-btn${viewMode === 'grid' ? ' active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  aria-label="그리드 뷰"
                >
                  <FiGrid size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="status-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`status-tab status-tab-${tab.key}${statusFilter === tab.key ? ' active' : ''}`}
                onClick={() => setStatusFilter(tab.key)}
              >
                {t(tab.labelKey)}
                {statusCounts[tab.key] > 0 && (
                  <span className="tab-count">{statusCounts[tab.key]}</span>
                )}
              </button>
            ))}
          </div>
          {filteredBooks.length === 0 && (
            <div className="filtered-empty">
              <FiXCircle size={20} className="empty-icon" />
              <p>{t('reading.noBooks')}</p>
            </div>
          )}
          {filteredBooks.length > 0 && viewMode === 'list' && (
            <div className="filtered-list">
              {filteredBooks.map((book, index) => (
                <BookCard key={book.slug} book={book} index={index} />
              ))}
            </div>
          )}
          {filteredBooks.length > 0 && viewMode === 'grid' && (
            <div className="filtered-grid">
              {filteredBooks.map((book) => (
                <motion.div
                  key={book.slug}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <GridBookCard book={book} />
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </main>
  );
}

export default Reading;
