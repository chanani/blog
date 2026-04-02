import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiBook, FiFileText } from 'react-icons/fi';
import { useLang } from '../../../hooks/useLang';
import './SearchResults.css';

function HighlightText({ text, query }) {
  if (!query || !text) return text;

  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="sr-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function SearchResults({
  query,
  bookResults,
  contentResults,
  indexing,
  indexProgress,
  focusIndex,
  onClose,
}) {
  const lang = useLang();
  const hasBooks = bookResults.length > 0;
  const hasContent = contentResults.length > 0;
  const showEmpty = !hasBooks && !hasContent && !indexing;
  const focusedRef = useRef(null);

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [focusIndex]);

  return (
    <div className="sr-dropdown">
      {/* Book results */}
      {hasBooks && (
        <div className="sr-section">
          <div className="sr-section-header">
            <FiBook size={14} />
            <span>책</span>
          </div>
          {bookResults.map((book, i) => (
            <Link
              key={book.slug}
              ref={i === focusIndex ? focusedRef : null}
              to={`/${lang}/book/${book.slug}`}
              className={`sr-item sr-book-item${i === focusIndex ? ' sr-item-focused' : ''}`}
              onClick={onClose}
            >
              <span className="sr-book-title">
                <HighlightText text={book.title} query={query} />
              </span>
              {book.author && (
                <span className="sr-book-author">{book.author}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Content results */}
      <div className="sr-section">
        <div className="sr-section-header">
          <FiFileText size={14} />
          <span>본문</span>
          {indexing && (
            <span className="sr-indexing-label">
              인덱싱 중... {indexProgress.done}/{indexProgress.total}
            </span>
          )}
        </div>

        {indexing && (
          <div className="sr-progress-wrap">
            <div
              className="sr-progress-bar"
              style={{
                width: indexProgress.total
                  ? `${(indexProgress.done / indexProgress.total) * 100}%`
                  : '0%',
              }}
            />
          </div>
        )}

        {hasContent &&
          contentResults.map((item, i) => {
            const flatIndex = bookResults.length + i;
            return (
              <Link
                key={`${item.bookSlug}-${item.chapterPath}-${i}`}
                ref={flatIndex === focusIndex ? focusedRef : null}
                to={`/${lang}/book/${item.bookSlug}/read/${item.chapterPath}`}
                className={`sr-item sr-content-item${flatIndex === focusIndex ? ' sr-item-focused' : ''}`}
                onClick={onClose}
              >
                <span className="sr-content-path">
                  {item.bookTitle} &gt; {item.chapterName}
                </span>
                <span className="sr-content-snippet">
                  <HighlightText text={item.snippet} query={query} />
                </span>
              </Link>
            );
          })}

        {!indexing && !hasContent && (
          <div className="sr-empty-content">
            {showEmpty ? '검색 결과가 없습니다.' : '본문 결과 없음'}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchResults;
