import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiArrowLeft, FiCalendar, FiEdit3, FiChevronLeft, FiChevronRight, FiList, FiMinus, FiPlus, FiSettings, FiLink, FiCheck, FiCopy, FiShare2, FiEye } from 'react-icons/fi';
import Giscus from '@giscus/react';
import useDevStore from '../../store/useDevStore';
import { useLang } from '../../hooks/useLang';
import { useTranslation } from 'react-i18next';
import { fetchViewCount } from '../../api/goatcounter';
import ImageModal from '../../components/ImageModal';
import { useChapterMemo } from '../../hooks/useChapterMemo';
import { applyMemosToDOM } from '../../utils/memoDOM';
import { useAuth } from '../../context/AuthContext';
import '../chapter/Chapter.css';
import './DevPost.css';

function extractHeadings(content) {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const headings = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s가-힣-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ level, text, id });
  }
  return headings;
}

const GITHUB_RAW = `https://raw.githubusercontent.com/${import.meta.env.VITE_GITHUB_OWNER}/${import.meta.env.VITE_GITHUB_REPO}/master`;

function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false);
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const code = String(children).trimStart().replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="code-block-wrapper">
      <button className="code-copy-btn" onClick={handleCopy} aria-label="코드 복사">
        {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
      </button>
      <SyntaxHighlighter
        style={theme === 'dark' ? oneDark : oneLight}
        language={language}
        PreTag="div"
        customStyle={{
          borderRadius: '6px',
          fontSize: '0.85rem',
          border: 'none',
          margin: 0,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function DevPost() {
  const { category, slug, seriesSlug, episodeSlug } = useParams();
  const isEpisode = !!episodeSlug;
  const effectiveSlug = isEpisode ? episodeSlug : slug;
  const navigate = useNavigate();
  const lang = useLang();
  const { t } = useTranslation();
  const { currentPost, loading, error, loadPost, clearPost, getPostNav, currentSeries, loadSeries, clearSeries } = useDevStore();
  const { prev, next } = isEpisode ? { prev: null, next: null } : getPostNav(category, effectiveSlug);

  const [episodePrev, episodeNext] = useMemo(() => {
    if (!isEpisode || !currentSeries?.episodes) return [null, null];
    const eps = currentSeries.episodes;
    const idx = eps.findIndex((ep) => ep.slug === episodeSlug);
    if (idx === -1) return [null, null];
    return [idx > 0 ? eps[idx - 1] : null, idx < eps.length - 1 ? eps[idx + 1] : null];
  }, [isEpisode, currentSeries, episodeSlug]);

  const displayPrev = isEpisode ? episodePrev : prev;
  const displayNext = isEpisode ? episodeNext : next;
  const [giscusTheme, setGiscusTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light',
  );
  const [activeId, setActiveId] = useState('');
  const [tocOpen, setTocOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('chapter-font-size');
    return saved ? parseInt(saved, 10) : 16;
  });
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('chapter-font-family') || 'default';
  });
  const [sepiaMode, setSepiaMode] = useState(() => {
    return localStorage.getItem('chapter-sepia-mode') === 'true';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fontSelectOpen, setFontSelectOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareToast, setShareToast] = useState(null);
  const [viewCount, setViewCount] = useState(null);
  const [zoomImages, setZoomImages] = useState([]);
  const [zoomIndex, setZoomIndex] = useState(-1);
  const [popupPos, setPopupPos] = useState(null);
  const [pendingText, setPendingText] = useState('');
  const postBodyRef = useRef(null);
  const { authenticated, getToken } = useAuth();
  const { memos, fetchMemos, addMemo, editMemo, deleteMemo } = useChapterMemo('_dev', `${category}/${effectiveSlug}`);
  const [memoMode, setMemoMode] = useState(false);
  const [memoNote, setMemoNote] = useState('');
  const [activeMemo, setActiveMemo] = useState(null);
  const [bubblePos, setBubblePos] = useState(null);
  const [editingMemo, setEditingMemo] = useState(null);
  const [memoAnnotationPositions, setMemoAnnotationPositions] = useState({});
  const [memoToast, setMemoToast] = useState(null);
  const memoModeRef = useRef(false);

  const showMemoToast = useCallback((message, type = 'success') => {
    setMemoToast({ message, type });
    setTimeout(() => setMemoToast(null), 2500);
  }, []);

  const SITE_URL = 'https://chanhan.blog';

  const showShareToast = (message) => {
    setShareToast(message);
    setTimeout(() => setShareToast(null), 2500);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleShare = async (channel) => {
    const shareUrl = `${SITE_URL}/post/${category}/${slug}`;
    const shareTitle = `${currentPost?.title} - 차나니의 블로그`;

    if (channel === 'x') {
      const text = encodeURIComponent(shareTitle);
      const url = encodeURIComponent(shareUrl);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer,width=550,height=420');
    }

    if (channel === 'facebook') {
      const url = encodeURIComponent(shareUrl);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'noopener,noreferrer,width=550,height=420');
    }
  };

  const changeFontSize = (delta) => {
    setFontSize((prev) => {
      const next = Math.min(Math.max(prev + delta, 14), 22);
      localStorage.setItem('chapter-font-size', String(next));
      return next;
    });
  };

  const changeFontFamily = (family) => {
    setFontFamily(family);
    localStorage.setItem('chapter-font-family', family);
  };

  const toggleSepiaMode = () => {
    setSepiaMode((prev) => {
      const next = !prev;
      localStorage.setItem('chapter-sepia-mode', String(next));
      return next;
    });
  };

  const fontFamilyOptions = [
    { value: 'default', label: '시스템 기본' },
    { value: 'pretendard', label: 'Pretendard' },
    { value: 'noto-sans', label: 'Noto Sans KR' },
    { value: 'noto-serif', label: 'Noto Serif KR' },
    { value: 'nanum-gothic', label: '나눔고딕' },
    { value: 'nanum-myeongjo', label: '나눔명조' },
    { value: 'ibm-plex', label: 'IBM Plex Sans KR' },
    { value: 'gmarket', label: 'Gmarket Sans' },
  ];

  const headings = useMemo(() => {
    if (!currentPost?.content) return [];
    return extractHeadings(currentPost.content);
  }, [currentPost?.content]);

  const markdownComponents = useMemo(
    () => ({
      h1({ children, ...props }) {
        const text = String(children);
        const id = text.toLowerCase().replace(/[^\w\s가-힣-]/g, '').replace(/\s+/g, '-');
        return <h1 id={id} {...props}>{children}</h1>;
      },
      h2({ children, ...props }) {
        const text = String(children);
        const id = text.toLowerCase().replace(/[^\w\s가-힣-]/g, '').replace(/\s+/g, '-');
        return <h2 id={id} {...props}>{children}</h2>;
      },
      h3({ children, ...props }) {
        const text = String(children);
        const id = text.toLowerCase().replace(/[^\w\s가-힣-]/g, '').replace(/\s+/g, '-');
        return <h3 id={id} {...props}>{children}</h3>;
      },
      img({ src, alt, ...props }) {
        const resolvedSrc = (() => {
          if (!src || /^https?:\/\//.test(src)) return src;
          const postDir = `dev/${category}`;
          const parts = src.split('/');
          const resolved = postDir.split('/');
          for (const part of parts) {
            if (part === '..') resolved.pop();
            else if (part !== '.') resolved.push(part);
          }
          return `${GITHUB_RAW}/${resolved.join('/')}`;
        })();
        return (
          <img
            src={resolvedSrc}
            alt={alt}
            style={{ cursor: 'zoom-in' }}
            onClick={() => {
              const imgs = Array.from(document.querySelectorAll('.chapter-body img'))
                .map((el) => ({ src: el.src, alt: el.alt }));
              const idx = imgs.findIndex((i) => i.src === resolvedSrc);
              setZoomImages(imgs);
              setZoomIndex(idx >= 0 ? idx : 0);
            }}
            {...props}
          />
        );
      },
      pre({ node }) {
        const codeNode = node.children?.find((c) => c.tagName === 'code') ?? node.children?.[0];
        if (codeNode?.tagName === 'code') {
          const cls = codeNode.properties?.className?.[0] || '';
          const match = /language-(\w+)/.exec(cls);
          const text = (codeNode.children?.map((c) => c.value ?? '').join('') || '').trimStart().replace(/\n+$/, '');
          return <CodeBlock language={match?.[1] || 'text'}>{text}</CodeBlock>;
        }
        return <pre>{node.children}</pre>;
      },
      code({ className, children, ...props }) {
        return <code className={className} {...props}>{children}</code>;
      },
    }),
    [category],
  );

  const handleScroll = useCallback(() => {
    const article = document.querySelector('.devpost-article');
    if (article) {
      const articleTop = article.offsetTop;
      const articleHeight = article.offsetHeight;
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      const articleEnd = articleTop + articleHeight - viewportHeight;
      const progress =
        articleEnd > articleTop
          ? Math.min(Math.max(((scrollTop - articleTop) / (articleEnd - articleTop)) * 100, 0), 100)
          : 100;
      setReadProgress(progress);
    }

    if (headings.length === 0) return;
    const scrollY = window.scrollY + 100;
    let current = '';
    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el && el.offsetTop <= scrollY) {
        current = heading.id;
      }
    }
    setActiveId(current);
  }, [headings]);

  useEffect(() => {
    const onScroll = () => { handleScroll(); updateMemoPositions(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [handleScroll, updateMemoPositions]);

  const scrollToHeading = (id) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
      setTocOpen(false);
    }
  };

  useEffect(() => {
    if (category && effectiveSlug) {
      loadPost(category, effectiveSlug, isEpisode ? seriesSlug : null);
      if (isEpisode && seriesSlug) loadSeries(category, seriesSlug);
      fetchViewCount(`/post/${category}/${isEpisode ? `${seriesSlug}/${effectiveSlug}` : effectiveSlug}`).then(setViewCount);
      fetchMemos();
    }
    return () => {
      clearPost();
      if (isEpisode) clearSeries();
    };
  }, [category, slug, seriesSlug, episodeSlug, loadPost, clearPost, loadSeries, clearSeries, fetchMemos]);

  useEffect(() => {
    memoModeRef.current = memoMode;
  }, [memoMode]);

  useEffect(() => {
    const lastTouchTime = { current: 0 };
    const onMouseUp = () => {
      if (Date.now() - lastTouchTime.current < 600) return;
      if (memoModeRef.current) return;
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length < 2) { setPopupPos(null); return; }
      const range = selection.getRangeAt(0);
      if (!postBodyRef.current?.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      setPopupPos({ x: rect.left + rect.width / 2, y: rect.top - 44 });
      setPendingText(text);
    };
    const onTouchEnd = () => {
      lastTouchTime.current = Date.now();
      setTimeout(() => {
        if (memoModeRef.current) return;
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (!text || text.length < 2) { setPopupPos(null); return; }
        const range = selection.getRangeAt(0);
        if (!postBodyRef.current?.contains(range.commonAncestorContainer)) return;
        const rect = range.getBoundingClientRect();
        setPopupPos({ x: rect.left + rect.width / 2, y: rect.bottom + 12 });
        setPendingText(text);
      }, 100);
    };
    const onClickOutside = (e) => {
      if (!e.target.closest('.memo-bubble') && !e.target.closest('.memo-highlight') && !e.target.closest('.memo-annotation')) {
        setActiveMemo(null);
        setBubblePos(null);
      }
    };
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const handleMemoIconClick = useCallback((memo, iconEl) => {
    const rect = iconEl.getBoundingClientRect();
    setBubblePos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    setActiveMemo(memo);
    setEditingMemo(null);
  }, []);

  const updateMemoPositions = useCallback(() => {
    const container = postBodyRef.current;
    if (!container) return;
    const positions = {};
    memos.forEach((memo) => {
      const el = container.querySelector(`mark[data-mid="${memo.id}"]`);
      if (el) positions[memo.id] = el.getBoundingClientRect().top;
    });
    setMemoAnnotationPositions(positions);
  }, [memos]);

  useEffect(() => {
    const container = postBodyRef.current;
    if (!container || !currentPost?.content) return;
    applyMemosToDOM(container, memos, handleMemoIconClick);
    requestAnimationFrame(updateMemoPositions);
  }, [memos, currentPost?.content, handleMemoIconClick, updateMemoPositions]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const t = document.documentElement.getAttribute('data-theme') || 'light';
      setGiscusTheme(t);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <main className="devpost-page">
        <div className="page-loading">
          <img src="/profile.jpg" alt="이찬한" className="loading-avatar" />
          <p className="loading-text">{t('loading.post')}</p>
          <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="devpost-page">
        <div className="devpost-wrap">
          <div className="chapter-status">
            <p className="status-msg">{t('post.errorMsg')}</p>
            <p className="status-detail">{error}</p>
            <button className="status-btn" onClick={() => navigate(`/${lang}/posts`)}>
              {t('post.back')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!currentPost) return null;

  return (
    <main className="devpost-page">
      <Helmet>
        <title>{currentPost.title} - 차나니의 블로그</title>
        <meta name="description" content={currentPost.description || `${currentPost.title} - 차나니의 블로그`} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://chanhan.blog/post/${category}/${slug}`} />
        <meta property="og:title" content={`${currentPost.title} - 차나니의 블로그`} />
        <meta property="og:description" content={currentPost.description || currentPost.title} />
        <meta property="og:image" content={currentPost.cover || 'https://chanhan.blog/profile.png'} />
        <meta property="article:author" content="이찬한" />
        {currentPost.date && <meta property="article:published_time" content={currentPost.date} />}
        {currentPost.updatedAt && <meta property="article:modified_time" content={currentPost.updatedAt} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${currentPost.title} - 차나니의 블로그`} />
        <meta name="twitter:description" content={currentPost.description || currentPost.title} />
        <meta name="twitter:image" content={currentPost.cover || 'https://chanhan.blog/profile.png'} />
        <link rel="canonical" href={`https://chanhan.blog/post/${category}/${slug}`} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: currentPost.title,
          description: currentPost.description || currentPost.title,
          image: currentPost.cover || 'https://chanhan.blog/profile.png',
          url: `https://chanhan.blog/post/${category}/${slug}`,
          datePublished: currentPost.date,
          dateModified: currentPost.updatedAt || currentPost.date,
          author: { '@type': 'Person', name: '이찬한', alternateName: '차나니', url: 'https://chanhan.blog/about' },
          publisher: { '@type': 'Person', name: '이찬한', url: 'https://chanhan.blog' },
          mainEntityOfPage: { '@type': 'WebPage', '@id': `https://chanhan.blog/post/${category}/${slug}` },
        })}</script>
      </Helmet>
      <div className="read-progress-bar" style={{ width: `${readProgress}%` }} />

      {memos.map((memo) => {
        const top = memoAnnotationPositions[memo.id];
        if (top === undefined || top < 56 || top > (window.innerHeight ?? 800) - 40) return null;
        return (
          <div
            key={memo.id}
            className={`memo-annotation${activeMemo?.id === memo.id ? ' active' : ''}`}
            style={{ top }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const el = postBodyRef.current?.querySelector(`mark[data-mid="${memo.id}"]`);
              if (el) {
                const rect = el.getBoundingClientRect();
                setBubblePos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
                setActiveMemo(memo);
                setEditingMemo(null);
              }
            }}
          >
            <span className="memo-annotation-label">✏ 메모</span>
            <span className="memo-annotation-note">{memo.note}</span>
          </div>
        );
      })}

      {headings.length > 0 && (
        <>
          <aside className={`toc-sidebar${tocOpen ? ' open' : ''}`}>
            <div className="toc-header">
              <span className="toc-title">{t('post.toc')}</span>
            </div>
            <nav className="toc-nav">
              {headings.map((h) => (
                <button
                  key={h.id}
                  className={`toc-item level-${h.level}${activeId === h.id ? ' active' : ''}`}
                  onClick={() => scrollToHeading(h.id)}
                >
                  {h.text}
                </button>
              ))}
            </nav>
          </aside>
          <button
            className="toc-toggle"
            onClick={() => setTocOpen(!tocOpen)}
            aria-label="목차 열기"
          >
            <FiList size={20} />
          </button>
          {tocOpen && <div className="toc-overlay" onClick={() => setTocOpen(false)} />}
        </>
      )}

      <motion.div
        className="devpost-wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <button className="back-link" onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} />
          <span>{t('post.back')}</span>
        </button>

        <article className="devpost-article">
          {currentPost.cover && (
            <div className="devpost-cover">
              <img src={currentPost.cover} alt={currentPost.title} />
            </div>
          )}
          <header className="devpost-header">
            <div className="devpost-header-top">
              <div className="devpost-meta-area">
                <div className="devpost-meta-row">
                  <span className="post-category-badge">{currentPost.category}</span>
                  {currentPost.date && (
                    <span className="devpost-date">
                      <FiCalendar size={13} />
                      {currentPost.date}
                    </span>
                  )}
                  {currentPost.updatedAt && currentPost.updatedAt !== currentPost.createdAt && (
                    <span className="devpost-date">
                      <FiEdit3 size={13} />
                      {t('post.updated')} {currentPost.updatedAt}
                    </span>
                  )}
                </div>
                <h1 className="devpost-title">{currentPost.title}</h1>
                {currentPost.tags && currentPost.tags.length > 0 && (
                  <div className="devpost-tags">
                    {currentPost.tags.map((tag) => (
                      <span key={tag} className="devpost-tag">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="chapter-settings">
                <button
                  className="settings-btn"
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  aria-label="설정"
                >
                  <FiSettings size={18} />
                </button>
                {settingsOpen && (
                  <>
                    <div className="settings-overlay" onClick={() => setSettingsOpen(false)} />
                    <div className="settings-dropdown">
                      <div className="settings-item">
                        <span className="settings-label">{t('post.settings.fontSize')}</span>
                        <div className="font-size-control">
                          <button
                            className="font-size-btn"
                            onClick={() => changeFontSize(-1)}
                            disabled={fontSize <= 14}
                            aria-label="글자 작게"
                          >
                            <FiMinus size={14} />
                          </button>
                          <span className="font-size-value">{fontSize}</span>
                          <button
                            className="font-size-btn"
                            onClick={() => changeFontSize(1)}
                            disabled={fontSize >= 22}
                            aria-label="글자 크게"
                          >
                            <FiPlus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="settings-item">
                        <span className="settings-label">{t('post.settings.font')}</span>
                        <div className="font-select-wrapper">
                          <button
                            className="font-select-btn"
                            onClick={() => setFontSelectOpen(!fontSelectOpen)}
                          >
                            <span>{fontFamilyOptions.find((f) => f.value === fontFamily)?.label}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          {fontSelectOpen && (
                            <>
                              <div className="font-select-overlay" onClick={() => setFontSelectOpen(false)} />
                              <div className="font-select-dropdown">
                                {fontFamilyOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    className={`font-select-option${fontFamily === option.value ? ' active' : ''}`}
                                    onClick={() => {
                                      changeFontFamily(option.value);
                                      setFontSelectOpen(false);
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="settings-item">
                        <span className="settings-label">{t('post.settings.sepia')}</span>
                        <button
                          className={`settings-toggle${sepiaMode ? ' active' : ''}`}
                          onClick={toggleSepiaMode}
                          aria-label="세피아 모드 토글"
                        >
                          <span className="settings-toggle-thumb" />
                        </button>
                      </div>
                      <button className="settings-copy-btn" onClick={copyUrl}>
                        {copied ? <FiCheck size={14} /> : <FiLink size={14} />}
                        <span>{copied ? t('post.settings.copied') : t('post.settings.copyUrl')}</span>
                      </button>
                      <div className="settings-share-divider" />
                      <p className="settings-share-label">{t('post.settings.share')}</p>
                      <div className="settings-share-row">
                        <button className="settings-share-btn" onClick={() => handleShare('x')} aria-label="X 공유">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                        </button>
                        <button className="settings-share-btn" onClick={() => handleShare('facebook')} aria-label="Facebook 공유">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <div ref={postBodyRef} className={`chapter-body font-${fontFamily}${sepiaMode ? ' sepia' : ''}`} style={{ fontSize: `${fontSize}px` }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {currentPost.content}
            </ReactMarkdown>
          </div>

          {popupPos && (
            <div
              className="highlight-popup"
              style={{ left: popupPos.x, top: popupPos.y }}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {!memoMode ? (
                <>
                  <button className="highlight-popup-btn memo-btn" onClick={() => setMemoMode(true)}>메모</button>
                  <button className="highlight-popup-cancel" onClick={() => { setPopupPos(null); setPendingText(''); setMemoMode(false); }}>✕</button>
                </>
              ) : (
                <>
                  <textarea
                    className="memo-textarea"
                    placeholder="메모를 입력하세요..."
                    value={memoNote}
                    onChange={(e) => setMemoNote(e.target.value)}
                    autoFocus
                    rows={3}
                  />
                  <div className="memo-popup-actions">
                    <button
                      className="highlight-popup-btn"
                      onClick={async () => {
                        if (!memoNote.trim()) return;
                        try {
                          const normalizedText = pendingText.replace(/\s+/g, ' ').trim();
                          const occurrence = memos.filter((m) => m.selectedText === normalizedText).length;
                          await addMemo(normalizedText, memoNote.trim(), occurrence, getToken());
                          setMemoNote('');
                          setMemoMode(false);
                          setPopupPos(null);
                          setPendingText('');
                          setTimeout(() => showMemoToast('메모가 저장되었습니다'), 0);
                        } catch {
                          setTimeout(() => showMemoToast('메모 저장 실패', 'error'), 0);
                        }
                      }}
                    >저장</button>
                    <button className="highlight-popup-cancel" onClick={() => { setMemoMode(false); setMemoNote(''); }}>취소</button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeMemo && bubblePos && (
            <>
              <div className="memo-modal-backdrop" onClick={() => { setActiveMemo(null); setBubblePos(null); setEditingMemo(null); setMemoNote(''); }} />
              <div
                className="memo-bubble"
                style={{
                  left: Math.max(10, Math.min(bubblePos.x - 160, window.innerWidth - 330)),
                  top: Math.min(bubblePos.y, window.innerHeight - 240),
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="memo-bubble-header">
                  <span className="memo-bubble-header-label">✏ 메모</span>
                  <button className="memo-bubble-close" onClick={() => { setActiveMemo(null); setBubblePos(null); setEditingMemo(null); setMemoNote(''); }}>✕</button>
                </div>
                {activeMemo.selectedText && <p className="memo-bubble-quote">"{activeMemo.selectedText}"</p>}
                <div className="memo-bubble-body">
                  {editingMemo === activeMemo.id ? (
                    <>
                      <textarea className="memo-textarea" value={memoNote} onChange={(e) => setMemoNote(e.target.value)} rows={4} autoFocus />
                      <div className="memo-popup-actions">
                        <button className="highlight-popup-btn" onClick={async () => {
                          try {
                            await editMemo(activeMemo.id, memoNote.trim(), getToken());
                            setActiveMemo(null); setBubblePos(null); setEditingMemo(null); setMemoNote('');
                            setTimeout(() => showMemoToast('메모가 수정되었습니다'), 0);
                          } catch { setTimeout(() => showMemoToast('메모 수정 실패', 'error'), 0); }
                        }}>저장</button>
                        <button className="highlight-popup-cancel" onClick={() => { setEditingMemo(null); setMemoNote(''); }}>취소</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="memo-bubble-text">{activeMemo.note}</p>
                      {authenticated && (
                        <div className="memo-bubble-actions">
                          <button className="memo-bubble-edit" onClick={() => { setEditingMemo(activeMemo.id); setMemoNote(activeMemo.note); }}>수정</button>
                          <button className="memo-bubble-delete" onClick={async () => {
                            try {
                              await deleteMemo(activeMemo.id, getToken());
                              setActiveMemo(null); setBubblePos(null);
                              setTimeout(() => showMemoToast('메모가 삭제되었습니다'), 0);
                            } catch { setTimeout(() => showMemoToast('메모 삭제 실패', 'error'), 0); }
                          }}>삭제</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </article>

        {(displayPrev || displayNext) && (
          <nav className={`chapter-nav${displayPrev && displayNext ? ' has-both' : ''}`}>
            {displayPrev && (
              <button
                className="chapter-nav-btn prev"
                onClick={() => navigate(
                  isEpisode
                    ? `/${lang}/post/${category}/${seriesSlug}/${displayPrev.slug}`
                    : `/${lang}/post/${displayPrev.category}/${displayPrev.slug}`
                )}
              >
                <FiChevronLeft size={18} />
                <div className="chapter-nav-text">
                  <span className="chapter-nav-label">{t('post.prev')}</span>
                  <span className="chapter-nav-title">{displayPrev.title}</span>
                </div>
              </button>
            )}
            {displayNext && (
              <button
                className="chapter-nav-btn next"
                onClick={() => navigate(
                  isEpisode
                    ? `/${lang}/post/${category}/${seriesSlug}/${displayNext.slug}`
                    : `/${lang}/post/${displayNext.category}/${displayNext.slug}`
                )}
              >
                <div className="chapter-nav-text">
                  <span className="chapter-nav-label">{t('post.next')}</span>
                  <span className="chapter-nav-title">{displayNext.title}</span>
                </div>
                <FiChevronRight size={18} />
              </button>
            )}
          </nav>
        )}

        <section className="chapter-comments">
          <Giscus
            repo="chanani/blog"
            repoId="R_kgDORI3Ksw"
            category="Announcements"
            categoryId="DIC_kwDORI3Ks84C15da"
            mapping="specific"
            term={`post/${category}/${slug}`}
            reactionsEnabled="1"
            emitMetadata="0"
            inputPosition="top"
            theme={`https://chanhan.blog/giscus-comment-${giscusTheme}.css?v=2`}
            lang="ko"
          />
        </section>
      </motion.div>

      {shareToast && (
        <div className="chapter-share-toast">
          <FiCheck size={14} />
          <span>{shareToast}</span>
        </div>
      )}

      {memoToast && (
        <div className={`memo-toast memo-toast--${memoToast.type}`}>
          {memoToast.type === 'success' ? <FiCheck size={14} /> : '✕'}
          <span>{memoToast.message}</span>
        </div>
      )}

      <ImageModal
        images={zoomImages}
        index={zoomIndex}
        onClose={() => setZoomIndex(-1)}
        onNavigate={setZoomIndex}
      />
    </main>
  );
}

export default DevPost;
