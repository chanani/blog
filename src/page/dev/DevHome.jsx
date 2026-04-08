import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiX, FiCalendar, FiEye, FiMessageSquare, FiChevronLeft, FiChevronRight, FiChevronDown } from 'react-icons/fi';
import useDevStore from '../../store/useDevStore';
import { fetchViewCountBatch } from '../../api/goatcounter';
import { useLang } from '../../hooks/useLang';
import defaultCover from '../../assets/images/default/default.png';
import './DevHome.css';

function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { t } = useTranslation();
  const SORT_OPTIONS = [
    { value: 'latest', label: t('blog.sortLatest') },
    { value: 'oldest', label: t('blog.sortOldest') },

    { value: 'comments', label: t('blog.sortComments') },
  ];
  const selected = SORT_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="sort-dropdown" ref={ref}>
      <button className="sort-dropdown-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected?.label}</span>
        <FiChevronDown size={13} className={`sort-arrow${open ? ' open' : ''}`} />
      </button>
      {open && (
        <ul className="sort-dropdown-menu">
          {SORT_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <button
                className={`sort-dropdown-item${opt.value === value ? ' active' : ''}`}
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

function isNew(dateStr) {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff >= 0 && diff < 5 * 24 * 60 * 60 * 1000;
}

function PostItem({ post, index, commentCount, viewCount }) {
  const [imgError, setImgError] = useState(false);
  const lang = useLang();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <Link to={`/${lang}/post/${post.category}/${post.slug}`} className="post-item">
        <div className="post-thumb">
          <img
            src={!imgError && post.cover ? post.cover : defaultCover}
            alt={post.title}
            onError={() => setImgError(true)}
          />
        </div>
        <div className="post-item-body">
          <div className="post-item-meta">
            <span className="post-cat-badge">{post.category}</span>
            {isNew(post.date) && <span className="post-new-badge">NEW</span>}
            {post.date && (
              <span className="post-meta-item">
                <FiCalendar size={11} />
                {post.date}
              </span>
            )}

            {commentCount > 0 && (
              <span className="post-meta-item">
                <FiMessageSquare size={11} />
                {commentCount}
              </span>
            )}
          </div>
          <h3 className="post-item-title">{post.title}</h3>
          {post.description && (
            <p className="post-item-desc">{post.description}</p>
          )}
          {post.tags && post.tags.length > 0 && (
            <div className="post-item-tags">
              {post.tags.map((tag) => (
                <span key={tag} className="post-item-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

function SeriesItem({ post, index }) {
  const [imgError, setImgError] = useState(false);
  const lang = useLang();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="series-card-wrap"
    >
      <Link to={`/${lang}/series/${post.category}/${post.slug}`} className="series-card">
        <div className="post-thumb">
          <img
            src={!imgError && post.cover ? post.cover : defaultCover}
            alt={post.title}
            onError={() => setImgError(true)}
          />
        </div>
        <div className="post-item-body">
          <div className="post-item-meta">
            <span className="post-cat-badge">{post.category}</span>
            <span className="series-meta-badge">SERIES · {post.episodeCount || 0}편</span>
            {isNew(post.date) && <span className="post-new-badge">NEW</span>}
            {post.date && (
              <span className="post-meta-item">
                <FiCalendar size={11} />
                {post.date}
              </span>
            )}
          </div>
          <h3 className="post-item-title">{post.title}</h3>
          {post.tags && post.tags.length > 0 && (
            <div className="post-item-tags">
              {post.tags.map((tag) => (
                <span key={tag} className="post-item-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

function DevHome() {
  const { t } = useTranslation();
  const lang = useLang();
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [sortOrder, setSortOrder] = useState('latest');
  const [viewCounts, setViewCounts] = useState({});
  const POSTS_PER_PAGE = 8;

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
    <main className="blog-page">
      <Helmet>
        <title>blog — chanani</title>
        <meta name="description" content="차나니의 개발 블로그 - Java, Spring, DevOps 등 백엔드 개발 기술 포스트를 기록합니다." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://chanhan.blog/posts" />
        <meta property="og:title" content="blog — chanani" />
        <meta property="og:description" content="차나니의 개발 블로그 - Java, Spring, DevOps 등 백엔드 개발 기술 포스트를 기록합니다." />
        <meta property="og:image" content="https://chanhan.blog/profile.png" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="blog — chanani" />
        <meta name="twitter:description" content="차나니의 개발 블로그 - Java, Spring, DevOps 등 백엔드 개발 기술 포스트를 기록합니다." />
        <meta name="twitter:image" content="https://chanhan.blog/profile.png" />
        <link rel="canonical" href="https://chanhan.blog/posts" />
      </Helmet>

      <div className="blog-layout">
        {/* ── Sidebar ── */}
        <aside className="blog-sidebar">
          <div className="sidebar-top">
            <div className="blog-search-wrap">
              <FiSearch size={14} className="blog-search-icon" />
              <input
                type="text"
                placeholder={t('blog.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="blog-search-input"
              />
              {searchQuery && (
                <button className="blog-search-clear" onClick={() => setSearchQuery('')}>
                  <FiX size={13} />
                </button>
              )}
            </div>
            <SortDropdown value={sortOrder} onChange={(v) => { setSortOrder(v); setCurrentPage(1); }} />
          </div>
          <ul className="sidebar-cat-list">
            {categories.map((cat) => (
              <li key={cat}>
                <button
                  className={`sidebar-cat-btn${selectedCategory === cat ? ' active' : ''}`}
                  onClick={() => { setCategory(cat); setCurrentPage(1); }}
                >
                  <span>{cat === 'all' ? t('reading.all') : cat}</span>
                  <span className="sidebar-cat-count">
                    {cat === 'all' ? posts.length : posts.filter((p) => p.category === cat).length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Content ── */}
        <div className="blog-content">
          {/* Loading */}
          {loading && (
            <div className="page-loading">
              <img src="/profile.jpg" alt="이찬한" className="loading-avatar" />
              <p className="loading-text">{t('loading.posts')}</p>
              <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="blog-status">
              <p>글 목록을 불러오지 못했습니다.</p>
              <button className="blog-retry-btn" onClick={refreshPosts}>다시 시도</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filteredPosts.length === 0 && (
            <div className="blog-status">
              <p>{searchQuery || selectedCategory !== 'all' ? t('blog.noResult') : t('blog.empty')}</p>
            </div>
          )}

          {/* Post List */}
          {!loading && filteredPosts.length > 0 && (
            <>
              <div className="post-list">
                {paginatedPosts.map((post, index) => (
                  post.isSeries
                    ? <SeriesItem key={`series/${post.category}/${post.slug}`} post={post} index={index} />
                    : <PostItem
                        key={`${post.category}/${post.slug}`}
                        post={post}
                        index={index}
                        commentCount={commentCounts[`${post.category}/${post.slug}`] || 0}
                        viewCount={viewCounts[`${post.category}/${post.slug}`] ?? 0}
                      />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <FiChevronLeft size={15} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={`page-num${currentPage === page ? ' active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <FiChevronRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default DevHome;
