import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { FiSearch, FiX, FiCalendar, FiEye, FiMessageSquare, FiChevronLeft, FiChevronRight, FiChevronDown } from 'react-icons/fi';
import useDevStore from '../../store/useDevStore';
import { fetchViewCountBatch } from '../../api/goatcounter';
import defaultCover from '../../assets/images/default/default.png';
import './DevHome.css';

function Dropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="dropdown" ref={ref}>
      <button className="dropdown-trigger" onClick={() => setOpen(!open)}>
        {selected?.label}
        <FiChevronDown size={14} className={`dropdown-arrow${open ? ' open' : ''}`} />
      </button>
      {open && (
        <ul className="dropdown-menu">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                className={`dropdown-item${opt.value === value ? ' active' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostCard({ post, index, commentCount, viewCount }) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link to={`/post/${post.category}/${post.slug}`} className="post-card has-cover">
        <div className="post-cover-wrap">
          <img
            src={!imgError && post.cover ? post.cover : defaultCover}
            alt={post.title}
            className="post-cover-img"
            onError={() => setImgError(true)}
          />
        </div>
        <div className="post-card-body">
          <div className="post-card-meta">
            <span className="post-category-badge">{post.category}</span>
            {post.date && (
              <span className="post-date">
                <FiCalendar size={12} />
                {post.date}
              </span>
            )}
            <span className="post-date">
              <FiEye size={12} />
              {viewCount ?? 0}
            </span>
            {commentCount > 0 && (
              <span className="comment-count">
                <FiMessageSquare size={12} />
                {commentCount}
              </span>
            )}
          </div>
          <h3 className="post-title">{post.title}</h3>
          {post.description && (
            <p className="post-description">{post.description}</p>
          )}
          {post.tags && post.tags.length > 0 && (
            <div className="post-tags">
              {post.tags.map((tag) => (
                <span key={tag} className="post-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

function DevHome() {
  const {
    loading,
    error,
    selectedCategory,
    searchQuery,
    posts,
    commentCounts,
    loadPosts,
    setCategory,
    setSearchQuery,
    getFilteredPosts,
    getCategories,
    refreshPosts,
  } = useDevStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get('page')) || 1;
  const setCurrentPage = (page) => {
    setSearchParams((prev) => {
      if (page <= 1) { prev.delete('page'); return prev; }
      prev.set('page', String(page));
      return prev;
    }, { replace: true });
  };
  const [sortOrder, setSortOrder] = useState('latest');
  const [viewCounts, setViewCounts] = useState({});
  const POSTS_PER_PAGE = 5;

  const SORT_OPTIONS = [
    { value: 'latest', label: '최신순' },
    { value: 'oldest', label: '오래된순' },
    { value: 'views', label: '조회순' },
    { value: 'comments', label: '댓글순' },
  ];

  const filteredPosts = getFilteredPosts();
  const categories = getCategories();

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    const keyA = `${a.category}/${a.slug}`;
    const keyB = `${b.category}/${b.slug}`;
    if (sortOrder === 'oldest') return (a.date || '').localeCompare(b.date || '');
    if (sortOrder === 'views') return (Number(viewCounts[keyB]) || 0) - (Number(viewCounts[keyA]) || 0);
    if (sortOrder === 'comments') return (commentCounts[keyB] || 0) - (commentCounts[keyA] || 0);
    return (b.date || '').localeCompare(a.date || '');
  });

  const totalPages = Math.ceil(sortedPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = sortedPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE,
  );

  useEffect(() => {
    loadPosts();
    return () => setSearchQuery('');
  }, [loadPosts, setSearchQuery]);

  useEffect(() => {
    if (posts.length === 0) return;
    const paths = posts.map((p) => `/post/${p.category}/${p.slug}`);
    fetchViewCountBatch(paths).then((data) => {
      const counts = {};
      posts.forEach((p) => {
        counts[`${p.category}/${p.slug}`] = data[`/post/${p.category}/${p.slug}`] ?? '0';
      });
      setViewCounts(counts);
    });
  }, [posts]);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, sortOrder]);

  return (
    <main className="dev-home">
      <Helmet>
        <title>차나니의 블로그</title>
        <meta name="description" content="차나니의 블로그 - 개발 기술 블로그 & 독서 기록" />
        <meta property="og:title" content="차나니의 블로그" />
        <meta property="og:description" content="개발 기술 블로그 & 독서 기록" />
        <link rel="canonical" href="https://chanani-books.vercel.app/" />
      </Helmet>

      <section className="dev-content">
        <div className="dev-search-wrap">
          <FiSearch size={18} className="dev-search-icon" />
          <input
            type="text"
            placeholder="제목, 태그, 설명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`dev-search-input${searchQuery ? ' has-value' : ''}`}
          />
          {searchQuery && (
            <button
              className="dev-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="검색 초기화"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        <div className="dev-filter-row">
          <Dropdown
            value={selectedCategory}
            options={categories.map((c) => ({
              value: c,
              label: `${c === 'all' ? '전체' : c} (${c === 'all' ? posts.length : posts.filter((p) => p.category === c).length})`,
            }))}
            onChange={setCategory}
          />
          <Dropdown
            value={sortOrder}
            options={SORT_OPTIONS}
            onChange={setSortOrder}
          />
        </div>

        {loading && (
          <div className="page-loading">
            <img src="/profile.jpg" alt="이찬한" className="loading-avatar" />
            <p className="loading-text">글 목록을 불러오는 중...</p>
            <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
          </div>
        )}

        {error && (
          <div className="dev-status">
            <p className="status-msg">글 목록을 불러오지 못했습니다</p>
            <p className="status-detail">{error}</p>
            <button className="status-btn" onClick={refreshPosts}>
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && filteredPosts.length === 0 && (
          <div className="dev-status">
            <p className="status-msg">
              {searchQuery || selectedCategory !== 'all'
                ? '검색 결과가 없습니다.'
                : '아직 작성된 글이 없습니다.'}
            </p>
          </div>
        )}

        {!loading && filteredPosts.length > 0 && (
          <>
            <div className="post-list">
              {paginatedPosts.map((post, index) => (
                <PostCard key={`${post.category}/${post.slug}`} post={post} index={index} commentCount={commentCounts[`${post.category}/${post.slug}`] || 0} viewCount={viewCounts[`${post.category}/${post.slug}`] ?? 0} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <FiChevronLeft size={16} />
                  이전
                </button>
                <div className="pagination-pages">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={`pagination-page${currentPage === page ? ' active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  className="pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  다음
                  <FiChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default DevHome;
