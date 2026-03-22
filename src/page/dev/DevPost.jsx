import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { fetchViewCount } from '../../api/goatcounter';
import ImageModal from '../../components/ImageModal';
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
  const code = String(children).replace(/^\n/, '').replace(/\n$/, '');

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
  const { category, slug } = useParams();
  const navigate = useNavigate();
  const { currentPost, loading, error, loadPost, clearPost, getPostNav } = useDevStore();
  const { prev, next } = getPostNav(category, slug);
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
        const codeNode = node.children?.[0];
        if (codeNode?.tagName === 'code') {
          const cls = codeNode.properties?.className?.[0] || '';
          const match = /language-(\w+)/.exec(cls);
          const text = codeNode.children?.map((c) => c.value).join('') || '';
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
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToHeading = (id) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
      setTocOpen(false);
    }
  };

  useEffect(() => {
    if (category && slug) {
      loadPost(category, slug);
      fetchViewCount(`/post/${category}/${slug}`).then(setViewCount);
    }
    return () => clearPost();
  }, [category, slug, loadPost, clearPost]);

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
          <p className="loading-text">글을 불러오는 중...</p>
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
            <p className="status-msg">글을 불러오지 못했습니다</p>
            <p className="status-detail">{error}</p>
            <button className="status-btn" onClick={() => navigate('/')}>
              목록으로 돌아가기
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
        <meta property="og:title" content={`${currentPost.title} - 차나니의 블로그`} />
        <meta property="og:description" content={currentPost.description || currentPost.title} />
        {currentPost.cover && <meta property="og:image" content={currentPost.cover} />}
        <link rel="canonical" href={`https://chanhan.blog/post/${category}/${slug}`} />
      </Helmet>
      <div className="read-progress-bar" style={{ width: `${readProgress}%` }} />

      {headings.length > 0 && (
        <>
          <aside className={`toc-sidebar${tocOpen ? ' open' : ''}`}>
            <div className="toc-header">
              <span className="toc-title">목차</span>
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
          <span>목록으로 돌아가기</span>
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
                      수정 {currentPost.updatedAt}
                    </span>
                  )}
                  <span className="devpost-date">
                    <FiEye size={13} />
                    조회 {viewCount ?? 0}
                  </span>
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
                        <span className="settings-label">글자 크기</span>
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
                        <span className="settings-label">글꼴</span>
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
                        <span className="settings-label">세피아 모드</span>
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
                        <span>{copied ? '복사됨' : 'URL 복사'}</span>
                      </button>
                      <div className="settings-share-divider" />
                      <p className="settings-share-label">공유하기</p>
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

          <div className={`chapter-body font-${fontFamily}${sepiaMode ? ' sepia' : ''}`} style={{ fontSize: `${fontSize}px` }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {currentPost.content}
            </ReactMarkdown>
          </div>
        </article>

        {(prev || next) && (
          <nav className={`chapter-nav${prev && next ? ' has-both' : ''}`}>
            {prev && (
              <button
                className="chapter-nav-btn prev"
                onClick={() => navigate(`/post/${prev.category}/${prev.slug}`)}
              >
                <FiChevronLeft size={18} />
                <div className="chapter-nav-text">
                  <span className="chapter-nav-label">이전</span>
                  <span className="chapter-nav-title">{prev.title}</span>
                </div>
              </button>
            )}
            {next && (
              <button
                className="chapter-nav-btn next"
                onClick={() => navigate(`/post/${next.category}/${next.slug}`)}
              >
                <div className="chapter-nav-text">
                  <span className="chapter-nav-label">다음</span>
                  <span className="chapter-nav-title">{next.title}</span>
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
