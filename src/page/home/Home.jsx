import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiBookOpen, FiX } from 'react-icons/fi';
import useBookStore from '../../store/useBookStore';
import useSearchStore from '../../store/useSearchStore';
import useDebounce from '../../hooks/useDebounce';
import { useLang } from '../../hooks/useLang';
import BookCard from './_components/BookCard';
import CategoryFilter from './_components/CategoryFilter';
import SearchResults from './_components/SearchResults';
import './Home.css';

function Home() {
  const { t } = useTranslation();
  const lang = useLang();
  const {
    loading,
    error,
    selectedCategory,
    searchQuery,
    loadBooks,
    setCategory,
    setSearchQuery,
    getFilteredBooks,
    getCategories,
    refreshBooks,
  } = useBookStore();

  const {
    indexing,
    indexReady,
    indexProgress,
    loadCachedIndex,
    buildIndex,
    searchContent,
  } = useSearchStore();

  const navigate = useNavigate();
  const [readingHistory, setReadingHistory] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [focusIndex, setFocusIndex] = useState(-1);
  const searchWrapRef = useRef(null);
  const inputRef = useRef(null);
  const debouncedQuery = useDebounce(searchQuery, 300);
  const isDebouncing = searchQuery !== debouncedQuery;

  // Derived state
  const books = useBookStore((s) => s.books);
  const filteredBooks = getFilteredBooks();
  const categories = getCategories();
  const contentResults = debouncedQuery.length >= 2 ? searchContent(debouncedQuery) : [];
  const showRecentPanel = dropdownOpen && searchQuery.length === 0 && recentSearches.length > 0;
  const showSearchResults = dropdownOpen && debouncedQuery.length >= 2;

  // --- Effects ---

  useEffect(() => {
    loadBooks();
    loadCachedIndex();
    const history = JSON.parse(localStorage.getItem('reading-history') || '[]');
    setReadingHistory(history);
    const saved = JSON.parse(localStorage.getItem('recent-searches') || '[]');
    setRecentSearches(saved);
    return () => setSearchQuery('');
  }, [loadBooks, loadCachedIndex, setSearchQuery]);

  useEffect(() => {
    if (debouncedQuery.length < 2) return;
    if (!indexReady && !indexing && books.length > 0) {
      buildIndex(books);
    }
  }, [debouncedQuery, indexReady, indexing, books, buildIndex]);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setDropdownOpen(true);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClick(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setFocusIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset focusIndex when results change
  useEffect(() => {
    setFocusIndex(-1);
  }, [debouncedQuery]);

  // --- Handlers ---

  const saveRecentSearch = (query) => {
    const q = query.trim();
    if (q.length < 2) return;
    const updated = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recent-searches', JSON.stringify(updated));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent-searches');
  };

  const handleSelectRecent = (query) => {
    setSearchQuery(query);
    setDropdownOpen(true);
    setFocusIndex(-1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDropdownOpen(false);
    setFocusIndex(-1);
    inputRef.current?.focus();
  };

  const handleResultClose = () => {
    if (debouncedQuery.length >= 2) {
      saveRecentSearch(debouncedQuery);
    }
    setDropdownOpen(false);
    setFocusIndex(-1);
  };

  const handleFocus = () => {
    if (searchQuery.length >= 2) {
      setDropdownOpen(true);
      return;
    }
    if (recentSearches.length > 0) {
      setDropdownOpen(true);
    }
  };

  const handleKeyDown = (e) => {
    if (!dropdownOpen) return;

    if (e.key === 'Escape') {
      setDropdownOpen(false);
      setFocusIndex(-1);
      return;
    }

    // Recent searches panel
    if (showRecentPanel) {
      const total = recentSearches.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
      } else if (e.key === 'Enter' && focusIndex >= 0) {
        e.preventDefault();
        handleSelectRecent(recentSearches[focusIndex]);
      }
      return;
    }

    // Search results panel
    if (showSearchResults) {
      const total = filteredBooks.length + contentResults.length;
      if (total === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
      } else if (e.key === 'Enter' && focusIndex >= 0) {
        e.preventDefault();
        if (focusIndex < filteredBooks.length) {
          const book = filteredBooks[focusIndex];
          saveRecentSearch(debouncedQuery);
          navigate(`/${lang}/book/${book.slug}`);
        } else {
          const item = contentResults[focusIndex - filteredBooks.length];
          saveRecentSearch(debouncedQuery);
          navigate(`/${lang}/book/${item.bookSlug}/read/${item.chapterPath}`);
        }
        setDropdownOpen(false);
        setFocusIndex(-1);
      }
    }
  };

  const removeHistoryItem = (e, bookSlug, chapterPath) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = readingHistory.filter(
      (h) => !(h.bookSlug === bookSlug && h.chapterPath === chapterPath)
    );
    setReadingHistory(updated);
    localStorage.setItem('reading-history', JSON.stringify(updated));
  };

  return (
    <main className="home">
      <Helmet>
        <title>책방 - 차나니의 블로그</title>
        <meta name="description" content="차나니의 책방 - 개발 서적 독서 기록과 정리. 클린코드, 오브젝트, 리팩터링 등 개발 서적을 읽고 챕터별로 정리합니다." />
        <meta property="og:title" content="책방 - 차나니의 블로그" />
        <meta property="og:description" content="개발 서적 독서 기록과 정리" />
        <link rel="canonical" href="https://chanhan.blog/books" />
      </Helmet>
      <section className="home-content">
        <div className="search-wrap" ref={searchWrapRef}>
          <FiSearch size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('books.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            className={`search-input${searchQuery ? ' has-value' : ''}`}
          />
          {isDebouncing && searchQuery.length >= 2 && (
            <span className="search-dots">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </span>
          )}
          {searchQuery && (
            <button
              className="search-clear"
              onClick={handleClearSearch}
              aria-label="검색 초기화"
            >
              <FiX size={16} />
            </button>
          )}
          {dropdownOpen && (
            <div
              className="search-backdrop"
              onMouseDown={() => setDropdownOpen(false)}
            />
          )}
          {showRecentPanel && (
            <div className="sr-dropdown sr-recent-dropdown">
              <div className="sr-section">
                <div className="sr-section-header">
                  <span>최근 검색어</span>
                  <button className="sr-clear-recent" onClick={clearRecentSearches}>
                    모두 삭제
                  </button>
                </div>
                {recentSearches.map((q, i) => (
                  <button
                    key={q}
                    className={`sr-item sr-recent-item${i === focusIndex ? ' sr-item-focused' : ''}`}
                    onClick={() => handleSelectRecent(q)}
                  >
                    <FiSearch size={14} className="sr-recent-icon" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {showSearchResults && (
            <SearchResults
              query={debouncedQuery}
              bookResults={filteredBooks}
              contentResults={contentResults}
              indexing={indexing}
              indexProgress={indexProgress}
              focusIndex={focusIndex}
              onClose={handleResultClose}
            />
          )}
        </div>

        {readingHistory.length > 0 && (
          <section className="reading-history">
            <h2 className="section-title">
              <FiBookOpen size={16} />
              {t('books.continueReading')}
            </h2>
            <div className="history-list">
              {readingHistory.slice(0, 1).map((item) => (
                <div key={`${item.bookSlug}-${item.chapterPath}`} className="history-item">
                  <Link
                    to={`/${lang}/book/${item.bookSlug}/read/${item.chapterPath}`}
                    className="history-link"
                  >
                    <div className="history-info">
                      <span className="history-book">{item.bookTitle}</span>
                      <span className="history-chapter">{item.chapterTitle}</span>
                    </div>
                    <div className="history-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="progress-text">{item.progress}%</span>
                    </div>
                  </Link>
                  <button
                    className="history-remove"
                    onClick={(e) => removeHistoryItem(e, item.bookSlug, item.chapterPath)}
                    aria-label="기록 삭제"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {categories.length > 1 && (
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setCategory}
          />
        )}

        {loading && (
          <div className="page-loading">
            <img src="/profile.jpg" alt="이찬한" className="loading-avatar" />
            <p className="loading-text">{t('loading.books')}</p>
            <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
          </div>
        )}

        {error && (
          <div className="home-status">
            <p className="status-msg">책 목록을 불러오지 못했습니다</p>
            <p className="status-detail">{error}</p>
            <button className="status-btn" onClick={refreshBooks}>
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && filteredBooks.length === 0 && (
          <div className="home-status">
            <p className="status-msg">
              {searchQuery || selectedCategory !== 'all'
                ? '검색 결과가 없습니다.'
                : '아직 등록된 책이 없습니다.'}
            </p>
          </div>
        )}

        {!loading && filteredBooks.length > 0 && (
          <div className="book-list">
            {filteredBooks.map((book, index) => (
              <BookCard key={book.slug} book={book} index={index} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Home;
