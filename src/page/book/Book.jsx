import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiChevronRight, FiMessageSquare, FiSearch, FiShare2, FiLink, FiCheck } from 'react-icons/fi';
import { BsStarFill, BsStarHalf, BsStar } from 'react-icons/bs';
import useBookStore from '../../store/useBookStore';
import './Book.css';

function Book() {
  const { bookSlug } = useParams();
  const navigate = useNavigate();
  const { currentBook, loading, error, loadBook, clearBook } = useBookStore();
  const [imgError, setImgError] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToast, setShareToast] = useState(null);

  const SITE_URL = 'https://chanhan.blog';

  const showShareToast = (message) => {
    setShareToast(message);
    setTimeout(() => setShareToast(null), 2500);
  };

  const handleShare = async (channel) => {
    const shareUrl = `${SITE_URL}/book/${bookSlug}`;
    const shareTitle = `${currentBook?.title} - 차나니의 블로그`;

    if (channel === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showShareToast('URL이 복사되었습니다');
      } catch {
        showShareToast('복사에 실패했습니다');
      }
      setShareOpen(false);
      return;
    }

    if (channel === 'x') {
      const text = encodeURIComponent(shareTitle);
      const url = encodeURIComponent(shareUrl);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer,width=550,height=420');
    }

    if (channel === 'facebook') {
      const url = encodeURIComponent(shareUrl);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,noreferrer,width=550,height=420');
    }

    setShareOpen(false);
  };

  useEffect(() => {
    loadBook(bookSlug);
    return () => clearBook();
  }, [bookSlug, loadBook, clearBook]);

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => {
      const fill = rating - i >= 1 ? 'full' : rating - i >= 0.5 ? 'half' : 'empty';
      if (fill === 'full') return <BsStarFill key={i} size={14} className="star-full" />;
      if (fill === 'half') return <BsStarHalf key={i} size={14} className="star-half" />;
      return <BsStar key={i} size={14} className="star-empty" />;
    });
  };

  if (loading) {
    return (
      <main className="book-page">
        <div className="page-loading">
          <img src="/profile.jpg" alt="이찬한" className="loading-avatar" />
          <p className="loading-text">책 정보를 불러오는 중...</p>
          <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="book-page">
        <div className="book-wrap">
          <div className="book-status">
            <p className="status-msg">책 정보를 불러오지 못했습니다</p>
            <p className="status-detail">{error}</p>
            <button className="status-btn" onClick={() => navigate('/books')}>
              책방으로 돌아가기
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!currentBook) return null;

  const commentCounts = currentBook.commentCounts || {};
  const searchQuery = chapterSearch.toLowerCase().trim();

  const filteredRootChapters = (currentBook.rootChapters || []).filter((ch) =>
    ch.name.toLowerCase().includes(searchQuery)
  );

  const filteredFolderGroups = Object.entries(currentBook.folderGroups || {}).reduce(
    (acc, [folder, chapters]) => {
      const filtered = chapters.filter((ch) =>
        ch.name.toLowerCase().includes(searchQuery)
      );
      if (filtered.length > 0) {
        acc[folder] = filtered;
      }
      return acc;
    },
    {}
  );

  const folderNames = Object.keys(filteredFolderGroups);
  const hasResults = filteredRootChapters.length > 0 || folderNames.length > 0;

  return (
    <main className="book-page">
      <Helmet>
        <title>{currentBook.title} - 차나니의 블로그</title>
        <meta name="description" content={`${currentBook.title} - ${currentBook.author || ''} 독서 기록과 챕터별 정리`} />
        <meta property="og:title" content={`${currentBook.title} - 차나니의 블로그`} />
        <meta property="og:description" content={`${currentBook.title} 독서 기록`} />
        {currentBook.cover && <meta property="og:image" content={currentBook.cover} />}
        <link rel="canonical" href={`https://chanhan.blog/book/${bookSlug}`} />
      </Helmet>
      <motion.div
        className="book-wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <button className="back-link" onClick={() => navigate('/books')}>
          <FiArrowLeft size={16} />
          <span>책방으로 돌아가기</span>
        </button>

        {/* Book Info Section */}
        <section className="book-info-section">
          <div className="book-cover-lg">
            {currentBook.cover && !imgError ? (
              <img
                src={currentBook.cover}
                alt={currentBook.title}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="cover-fallback-lg">
                <span>&#128214;</span>
              </div>
            )}
          </div>

          <div className="book-info-detail">
            <div className="info-title-row">
              <h1 className="info-title">{currentBook.title}</h1>
              {currentBook.status && (
                <span className={`book-status-badge status-${currentBook.status}`}>
                  {currentBook.status}
                </span>
              )}
              <div className="book-share-wrapper">
                <button
                  className="book-share-btn"
                  onClick={() => setShareOpen(!shareOpen)}
                  aria-label="공유하기"
                >
                  <FiShare2 size={16} />
                </button>
                {shareOpen && (
                  <>
                    <div className="book-share-overlay" onClick={() => setShareOpen(false)} />
                    <div className="book-share-dropdown">
                      <button className="book-share-item" onClick={() => handleShare('copy')}>
                        <FiLink size={14} />
                        <span>URL 복사</span>
                      </button>
                      <button className="book-share-item" onClick={() => handleShare('x')}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        <span>X</span>
                      </button>
                      <button className="book-share-item" onClick={() => handleShare('facebook')}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        <span>Facebook</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            {currentBook.subtitle && (
              <p className="info-subtitle">{currentBook.subtitle}</p>
            )}
            <div className="info-author-row">
              {currentBook.author && (
                <span className="info-author">{currentBook.author}</span>
              )}
              {currentBook.category && (
                <span className="info-category">{currentBook.category}</span>
              )}
            </div>
            {currentBook.rating > 0 && (
              <div className="info-rating">
                {renderStars(currentBook.rating)}
              </div>
            )}

            <div className="info-metas">
              {currentBook.publisher && (
                <div className="info-meta-row">
                  <span className="meta-label">출판사</span>
                  <span className="meta-value">{currentBook.publisher}</span>
                </div>
              )}
              {currentBook.totalPages && (
                <div className="info-meta-row">
                  <span className="meta-label">쪽수</span>
                  <span className="meta-value">{currentBook.totalPages}쪽</span>
                </div>
              )}
            </div>

            {currentBook.tags && currentBook.tags.length > 0 && (
              <div className="info-tags">
                {currentBook.tags.map((tag) => (
                  <span key={tag} className="info-tag">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Chapter List */}
        <section className="chapter-section">
          <div className="chapter-section-header">
            <h2 className="section-title">
              목차
              <span className="chapter-count">{currentBook.totalChapters}</span>
            </h2>
            <div className="chapter-header-actions">
              {currentBook.totalChapters > 0 && (
                <>
                  <div className="chapter-search">
                    <FiSearch size={14} className="chapter-search-icon" />
                    <input
                      type="text"
                      placeholder="챕터 검색..."
                      value={chapterSearch}
                      onChange={(e) => setChapterSearch(e.target.value)}
                      className="chapter-search-input"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {filteredRootChapters.length > 0 && (
            <div className="chapter-group">
              {filteredRootChapters.map((ch) => (
                <Link
                  key={ch.path}
                  to={`/book/${bookSlug}/read/${ch.path}`}
                  className="chapter-item"
                >
                  <span className="chapter-name">{ch.name}</span>
                  <div className="chapter-right">
                    {commentCounts[ch.path] > 0 && (
                      <span className="comment-count">
                        <FiMessageSquare size={12} />
                        {commentCounts[ch.path]}
                      </span>
                    )}
                    <FiChevronRight size={16} className="chapter-arrow" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {folderNames.map((folder) => (
            <div key={folder}>
              <h3 className="folder-title">{folder}</h3>
              <div className="chapter-group">
                {filteredFolderGroups[folder].map((ch) => (
                  <Link
                    key={ch.path}
                    to={`/book/${bookSlug}/read/${ch.path}`}
                    className="chapter-item"
                  >
                    <span className="chapter-name">{ch.name}</span>
                    <div className="chapter-right">
                      {commentCounts[ch.path] > 0 && (
                        <span className="comment-count">
                          <FiMessageSquare size={12} />
                          {commentCounts[ch.path]}
                        </span>
                      )}
                      <FiChevronRight size={16} className="chapter-arrow" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {currentBook.totalChapters === 0 && (
            <p className="no-chapters">아직 작성된 챕터가 없습니다.</p>
          )}

          {currentBook.totalChapters > 0 && !hasResults && (
            <p className="no-chapters">검색 결과가 없습니다.</p>
          )}
        </section>

      </motion.div>

      {shareToast && (
        <div className="book-share-toast">
          <FiCheck size={14} />
          <span>{shareToast}</span>
        </div>
      )}
    </main>
  );
}

export default Book;
