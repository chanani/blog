import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FiArrowLeft, FiCalendar, FiEdit3, FiChevronLeft, FiChevronRight, FiList, FiMinus, FiPlus, FiSettings, FiLink, FiCheck, FiCopy, FiDownload, FiShare2, FiEye } from 'react-icons/fi';
import Giscus from '@giscus/react';
import useBookStore from '../../store/useBookStore';
import { useLang } from '../../hooks/useLang';
import { useTranslation } from 'react-i18next';
import { fetchViewCount } from '../../api/goatcounter';
import ImageModal from '../../components/ImageModal';
import { useHighlight } from '../../hooks/useHighlight';
import { applyHighlightsToDOM } from '../../utils/highlightDOM';
import { useChapterMemo } from '../../hooks/useChapterMemo';
import { applyMemosToDOM } from '../../utils/memoDOM';
import { useAuth } from '../../context/AuthContext';
import './Chapter.css';

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
const BOOKS_PATH = import.meta.env.VITE_GITHUB_PATH || 'books';

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

function Chapter() {
  const { bookSlug, '*': chapterPath } = useParams();
  const navigate = useNavigate();
  const lang = useLang();
  const { t } = useTranslation();
  const { currentChapter, loading, error, loadChapter, clearChapter, getChapterNav } =
    useBookStore();
  const { prev, next } = getChapterNav(chapterPath);
  const [giscusTheme, setGiscusTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fontSelectOpen, setFontSelectOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareToast, setShareToast] = useState(null);
  const [viewCount, setViewCount] = useState(null);
  const [zoomImages, setZoomImages] = useState([]);
  const [zoomIndex, setZoomIndex] = useState(-1);
  const [popupPos, setPopupPos] = useState(null);
  const [pendingText, setPendingText] = useState('');
  const chapterBodyRef = useRef(null);
  const { highlights, addHighlight, removeHighlight } = useHighlight(bookSlug, chapterPath);
  const { authenticated, getToken } = useAuth();
  const { memos, fetchMemos, addMemo, editMemo, deleteMemo } = useChapterMemo(bookSlug, chapterPath);
  const [memoMode, setMemoMode] = useState(false);
  const [memoNote, setMemoNote] = useState('');
  const [activeMemo, setActiveMemo] = useState(null);
  const [bubblePos, setBubblePos] = useState(null);
  const [editingMemo, setEditingMemo] = useState(null);
  const [memoAnnotationPositions, setMemoAnnotationPositions] = useState({});
  const [memoToast, setMemoToast] = useState(null);

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
    const shareUrl = `${SITE_URL}/book/${bookSlug}/read/${chapterPath}`;
    const shareTitle = `${currentChapter?.title} - 차나니의 블로그`;

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

  const lastTouchTimeRef = useRef(0);
  const memoModeRef = useRef(false);

  const handlePopupDismiss = useCallback((e) => {
    if (e.target.closest('.highlight-popup')) return;
    setPopupPos(null);
    setPendingText('');
  }, []);

  useEffect(() => {
    memoModeRef.current = memoMode;
  }, [memoMode]);

  useEffect(() => {
    const lastTouchTime = lastTouchTimeRef;

    const onMouseUp = () => {
      if (Date.now() - lastTouchTime.current < 600) return;
      if (memoModeRef.current) return; // 메모 입력 중엔 팝업 닫지 않음
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (!text || text.length < 2) { setPopupPos(null); return; }
      const range = selection.getRangeAt(0);
      if (!chapterBodyRef.current?.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      setPopupPos({ x: rect.left + rect.width / 2, y: rect.top - 44 });
      setPendingText(text);
    };

    const onTouchEnd = () => {
      lastTouchTime.current = Date.now();
      setTimeout(() => {
        if (memoModeRef.current) return; // 메모 입력 중엔 팝업 닫지 않음
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (!text || text.length < 2) { setPopupPos(null); return; }
        const range = selection.getRangeAt(0);
        if (!chapterBodyRef.current?.contains(range.commonAncestorContainer)) return;
        const rect = range.getBoundingClientRect();
        setPopupPos({ x: rect.left + rect.width / 2, y: rect.bottom + 12 });
        setPendingText(text);
      }, 100);
    };

    const onClickOutside = (e) => {
      if (
        !e.target.closest('.memo-bubble') &&
        !e.target.closest('.memo-icon') &&
        !e.target.closest('.memo-highlight') &&
        !e.target.closest('.memo-annotation')
      ) {
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

  const handleHighlightSave = useCallback(() => {
    if (!pendingText) return;
    addHighlight(pendingText);
    window.getSelection()?.removeAllRanges();
    setPopupPos(null);
    setPendingText('');
  }, [pendingText, addHighlight]);

  const handlePopupClose = useCallback(() => {
    setPopupPos(null);
    setPendingText('');
  }, []);

  const handleMemoIconClick = useCallback((memo, iconEl) => {
    const rect = iconEl.getBoundingClientRect();
    setBubblePos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    setActiveMemo(memo);
    setEditingMemo(null);
  }, []);

  const updateMemoPositions = useCallback(() => {
    const container = chapterBodyRef.current;
    if (!container) return;
    const positions = {};
    memos.forEach((memo) => {
      const el = container.querySelector(`mark[data-mid="${memo.id}"]`);
      if (el) positions[memo.id] = el.getBoundingClientRect().top;
    });
    setMemoAnnotationPositions(positions);
  }, [memos]);

  useEffect(() => {
    const container = chapterBodyRef.current;
    if (!container || !currentChapter?.content) return;
    applyHighlightsToDOM(container, highlights, removeHighlight);
    applyMemosToDOM(container, memos, handleMemoIconClick);
    requestAnimationFrame(updateMemoPositions);
  }, [highlights, memos, currentChapter?.content, removeHighlight, handleMemoIconClick, updateMemoPositions]);

  const downloadPdf = async () => {
    setSettingsOpen(false);
    setPdfLoading(true);

    const element = document.querySelector('.chapter-body');
    if (!element) {
      setPdfLoading(false);
      return;
    }

    const [domtoimage, { jsPDF }] = await Promise.all([
      import('dom-to-image-more'),
      import('jspdf'),
    ]);

    // 복제본 생성 (화면 밖에 배치, PC 사이즈 고정)
    const clone = document.createElement('div');
    clone.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 1400px;
      background: #ffffff;
      color: #1a1a1a;
      padding: 60px;
      font-size: 18px;
      line-height: 1.8;
    `;

    // 제목 추가
    const title = document.createElement('h1');
    title.textContent = currentChapter?.title || '';
    title.style.cssText = `
      font-size: 32px;
      font-weight: 700;
      color: #1a1a1a;
      margin: 0 0 12px 0;
      padding-bottom: 20px;
      border-bottom: 3px solid #e8735a;
    `;
    clone.appendChild(title);

    // 본문 복제
    const body = element.cloneNode(true);
    body.style.cssText = 'background: transparent; color: #1a1a1a;';
    clone.appendChild(body);

    // 라이트 모드 스타일 적용
    body.querySelectorAll('*').forEach((el) => {
      el.style.color = '#1a1a1a';
      el.style.backgroundColor = 'transparent';

      if (el.tagName === 'P') {
        if (!el.closest('blockquote')) {
          el.style.marginBottom = '16px';
        } else {
          el.style.margin = '0';
          el.style.padding = '0';
        }
        el.style.lineHeight = '1.8';
      }
      if (el.tagName === 'A') el.style.color = '#2563eb';
      if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4') {
        el.style.marginTop = '24px';
        el.style.marginBottom = '12px';
      }
      if (el.tagName === 'PRE') {
        el.style.backgroundColor = '#f5f5f5';
        el.style.color = '#333';
        el.style.padding = '12px';
        el.style.borderRadius = '6px';
        el.style.marginBottom = '16px';
      }
      if (el.tagName === 'CODE') {
        el.style.color = '#333';
        if (!el.closest('pre')) {
          el.style.backgroundColor = '#f0f0f0';
          el.style.padding = '2px 6px';
          el.style.borderRadius = '4px';
        }
      }
      if (el.tagName === 'BLOCKQUOTE') {
        el.style.borderLeft = '4px solid #e8735a';
        el.style.padding = '12px 16px';
        el.style.margin = '16px 0';
        el.style.background = '#f5f5f5';
        el.style.color = '#555';
      }
      if (el.tagName === 'UL') {
        el.style.marginBottom = '16px';
        el.style.paddingLeft = '24px';
        el.style.listStyleType = 'disc';
      }
      if (el.tagName === 'OL') {
        el.style.marginBottom = '16px';
        el.style.paddingLeft = '24px';
        el.style.listStyleType = 'decimal';
      }
      if (el.tagName === 'LI') {
        el.style.marginBottom = '8px';
        el.style.display = 'list-item';
      }
      if (el.tagName === 'STRONG' || el.tagName === 'B') {
        el.style.backgroundColor = 'transparent';
        el.style.fontWeight = '700';
      }
      if (el.tagName === 'HR') {
        el.style.border = 'none';
        el.style.borderTop = '1px solid #ddd';
        el.style.margin = '24px 0';
      }
      if (el.tagName === 'TABLE') {
        el.style.width = '100%';
        el.style.borderCollapse = 'collapse';
        el.style.marginBottom = '16px';
      }
      if (el.tagName === 'TH' || el.tagName === 'TD') {
        el.style.border = '1px solid #ddd';
        el.style.padding = '8px 12px';
      }
      if (el.tagName === 'TH') {
        el.style.backgroundColor = '#f5f5f5';
        el.style.fontWeight = '600';
      }
      if (el.tagName === 'IMG') {
        el.style.maxWidth = '100%';
      }
    });

    document.body.appendChild(clone);

    // 렌더링 대기
    await new Promise((r) => setTimeout(r, 200));

    try {
      const scale = 4;
      const dataUrl = await domtoimage.toPng(clone, {
        quality: 1,
        bgcolor: '#ffffff',
        width: clone.offsetWidth * scale,
        height: clone.offsetHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        },
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 15;
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = pdfHeight - margin * 2;

      const ratio = contentWidth / clone.offsetWidth;
      const scaledHeight = clone.offsetHeight * ratio;
      const totalPages = Math.ceil(scaledHeight / contentHeight);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const sourceY = page * (contentHeight / ratio) * scale;
        const sourceHeight = (contentHeight / ratio) * scale;

        canvas.width = img.width;
        canvas.height = sourceHeight;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          img,
          0, sourceY, img.width, Math.min(sourceHeight, img.height - sourceY),
          0, 0, img.width, Math.min(sourceHeight, img.height - sourceY)
        );

        const pageData = canvas.toDataURL('image/png', 1.0);
        pdf.addImage(pageData, 'PNG', margin, margin, contentWidth, contentHeight);
      }

      pdf.save(`${currentChapter?.title || 'chapter'}.pdf`);
    } finally {
      document.body.removeChild(clone);
      setPdfLoading(false);
    }
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
    if (!currentChapter?.content) return [];
    return extractHeadings(currentChapter.content);
  }, [currentChapter?.content]);

  const markdownComponents = useMemo(() => ({
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
        const chapterDir = `${BOOKS_PATH}/${bookSlug}/${chapterPath}`.split('/').slice(0, -1);
        const parts = src.split('/');
        for (const part of parts) {
          if (part === '..') chapterDir.pop();
          else if (part !== '.') chapterDir.push(part);
        }
        return `${GITHUB_RAW}/${chapterDir.join('/')}`;
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
  }), [bookSlug, chapterPath]);

  const saveReadingHistory = useCallback((progress) => {
    if (!currentChapter) return;
    const historyKey = 'reading-history';
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const entry = {
      bookSlug,
      chapterPath,
      chapterTitle: currentChapter.title,
      bookTitle: currentChapter.bookTitle || bookSlug,
      progress: Math.round(progress),
      timestamp: Date.now(),
    };
    const filtered = history.filter(
      (h) => !(h.bookSlug === bookSlug && h.chapterPath === chapterPath)
    );
    filtered.unshift(entry);
    localStorage.setItem(historyKey, JSON.stringify(filtered.slice(0, 10)));
  }, [bookSlug, chapterPath, currentChapter]);

  const handleScroll = useCallback(() => {
    // 읽기 진행률 계산 (chapter-article 기준)
    const article = document.querySelector('.chapter-article');
    let progress = 0;
    if (article) {
      const articleTop = article.offsetTop;
      const articleHeight = article.offsetHeight;
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      const articleEnd = articleTop + articleHeight - viewportHeight;
      progress = articleEnd > articleTop
        ? Math.min(Math.max((scrollTop - articleTop) / (articleEnd - articleTop) * 100, 0), 100)
        : 100;
      setReadProgress(progress);
    }

    // 목차 활성 항목 계산
    if (headings.length === 0) return;
    const scrollY = window.scrollY + window.innerHeight * 0.35;
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

  // 읽기 기록 저장 (진행률 변경 시)
  useEffect(() => {
    if (currentChapter && readProgress > 0) {
      saveReadingHistory(readProgress);
    }
  }, [currentChapter, readProgress, saveReadingHistory]);

  const scrollToHeading = (id) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
      setActiveId(id);
      setTocOpen(false);
    }
  };

  useEffect(() => {
    if (chapterPath) {
      loadChapter(bookSlug, chapterPath);
      fetchViewCount(`/book/${bookSlug}/read/${chapterPath}`).then(setViewCount);
      fetchMemos();
    }
    return () => clearChapter();
  }, [bookSlug, chapterPath, loadChapter, clearChapter, fetchMemos]);

  // 저장된 읽기 위치로 스크롤 복원
  useEffect(() => {
    if (!currentChapter || loading) return;

    const history = JSON.parse(localStorage.getItem('reading-history') || '[]');
    const saved = history.find(
      (h) => h.bookSlug === bookSlug && h.chapterPath === chapterPath
    );

    if (saved && saved.progress > 0 && saved.progress < 100) {
      setTimeout(() => {
        const article = document.querySelector('.chapter-article');
        if (!article) return;

        const articleTop = article.offsetTop;
        const articleHeight = article.scrollHeight;
        const viewportHeight = window.innerHeight;
        const articleEnd = articleTop + articleHeight - viewportHeight;
        const scrollTarget = articleTop + ((articleEnd - articleTop) * saved.progress) / 100;

        window.scrollTo({ top: scrollTarget, behavior: 'auto' });
      }, 100);
    }
  }, [currentChapter, loading, bookSlug, chapterPath]);

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
      <main className="chapter-page">
        <div className="page-loading">
          <img src="/profile.jpg" alt="이찬한" className="loading-avatar" />
          <p className="loading-text">{t('loading.chapter')}</p>
          <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="chapter-page">
        <div className="chapter-wrap">
          <div className="chapter-status">
            <p className="status-msg">{t('chapter.errorMsg')}</p>
            <p className="status-detail">{error}</p>
            <button
              className="status-btn"
              onClick={() => navigate(`/${lang}/book/${bookSlug}`)}
            >
              {t('chapter.back')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!currentChapter) return null;

  return (
    <main className="chapter-page">
      <Helmet>
        <title>{currentChapter.title} - 차나니의 블로그</title>
        <meta name="description" content={`${currentChapter.bookTitle} - ${currentChapter.title} 독서 정리`} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://chanhan.blog/book/${bookSlug}/read/${chapterPath}`} />
        <meta property="og:title" content={`${currentChapter.title} - 차나니의 블로그`} />
        <meta property="og:description" content={`${currentChapter.bookTitle} - ${currentChapter.title} 독서 정리`} />
        <meta property="og:image" content={currentChapter.cover || 'https://chanhan.blog/profile.png'} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${currentChapter.title} - 차나니의 블로그`} />
        <meta name="twitter:description" content={`${currentChapter.bookTitle} - ${currentChapter.title} 독서 정리`} />
        <meta name="twitter:image" content={currentChapter.cover || 'https://chanhan.blog/profile.png'} />
        <link rel="canonical" href={`https://chanhan.blog/book/${bookSlug}/read/${chapterPath}`} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: currentChapter.title,
          description: `${currentChapter.bookTitle} - ${currentChapter.title} 독서 정리`,
          image: currentChapter.cover || 'https://chanhan.blog/profile.png',
          url: `https://chanhan.blog/book/${bookSlug}/read/${chapterPath}`,
          datePublished: currentChapter.createdAt,
          dateModified: currentChapter.updatedAt || currentChapter.createdAt,
          author: { '@type': 'Person', name: '이찬한', alternateName: '차나니', url: 'https://chanhan.blog/about' },
          isPartOf: { '@type': 'Book', name: currentChapter.bookTitle, url: `https://chanhan.blog/book/${bookSlug}` },
        })}</script>
      </Helmet>
      <div className="read-progress-bar" style={{ width: `${readProgress}%` }} />

      {pdfLoading && (
        <div className="pdf-loading-toast">
          <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
          <span>PDF 생성 중...</span>
        </div>
      )}

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
              const el = chapterBodyRef.current?.querySelector(`mark[data-mid="${memo.id}"]`);
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
              <span className="toc-title">{t('chapter.toc')}</span>
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
        className="chapter-wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <button
          className="back-link"
          onClick={() => navigate(`/${lang}/book/${bookSlug}`)}
        >
          <FiArrowLeft size={16} />
          <span>{t('chapter.back')}</span>
        </button>

        <article className="chapter-article">
          <header className="chapter-header">
            <div className="chapter-header-top">
              <h1 className="chapter-title">{currentChapter.title}</h1>
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
                        <span className="settings-label">{t('chapter.settings.fontSize')}</span>
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
                        <span className="settings-label">{t('chapter.settings.font')}</span>
                        <div className="font-select-wrapper">
                          <button
                            className="font-select-btn"
                            onClick={() => setFontSelectOpen(!fontSelectOpen)}
                          >
                            <span>{fontFamilyOptions.find(f => f.value === fontFamily)?.label}</span>
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
                        <span className="settings-label">{t('chapter.settings.sepia')}</span>
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
                        <span>{copied ? t('chapter.settings.copied') : t('chapter.settings.copyUrl')}</span>
                      </button>
                      <button className="settings-copy-btn" onClick={downloadPdf}>
                        <FiDownload size={14} />
                        <span>{t('chapter.settings.pdf')}</span>
                      </button>
                      <div className="settings-share-divider" />
                      <p className="settings-share-label">{t('chapter.settings.share')}</p>
                      <div className="settings-share-row">
                        <button className="settings-share-btn" onClick={() => handleShare('x')} aria-label="X 공유">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </button>
                        <button className="settings-share-btn" onClick={() => handleShare('facebook')} aria-label="Facebook 공유">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {(currentChapter.createdAt || currentChapter.updatedAt) && (
              <div className="chapter-dates">
                {currentChapter.createdAt && (
                  <span className="chapter-date-item">
                    <FiCalendar size={13} />
                    {t('chapter.written')} {currentChapter.createdAt}
                  </span>
                )}
                {currentChapter.updatedAt &&
                  currentChapter.updatedAt !== currentChapter.createdAt && (
                    <span className="chapter-date-item">
                      <FiEdit3 size={13} />
                      {t('chapter.updated')} {currentChapter.updatedAt}
                    </span>
                  )}
              </div>
            )}
          </header>

          <div
            ref={chapterBodyRef}
            className={`chapter-body font-${fontFamily}${sepiaMode ? ' sepia' : ''}`}
            style={{ fontSize: `${fontSize}px` }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {currentChapter.content}
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
                  <button className="highlight-popup-btn" onClick={handleHighlightSave}>형광펜</button>
                  <button className="highlight-popup-btn memo-btn" onClick={() => setMemoMode(true)}>메모</button>
                  <button className="highlight-popup-cancel" onClick={() => { handlePopupClose(); setMemoMode(false); }}>✕</button>
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
                          handlePopupClose();
                          setTimeout(() => showMemoToast('메모가 저장되었습니다'), 0);
                        } catch (err) {
                          setTimeout(() => showMemoToast('메모 저장 실패', 'error'), 0);
                        }
                      }}
                    >
                      저장
                    </button>
                    <button className="highlight-popup-cancel" onClick={() => { setMemoMode(false); setMemoNote(''); }}>취소</button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeMemo && bubblePos && (
            <>
              <div
                className="memo-modal-backdrop"
                onClick={() => { setActiveMemo(null); setBubblePos(null); setEditingMemo(null); setMemoNote(''); }}
              />
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
                  <button
                    className="memo-bubble-close"
                    onClick={() => { setActiveMemo(null); setBubblePos(null); setEditingMemo(null); setMemoNote(''); }}
                  >✕</button>
                </div>

                {activeMemo.selectedText && (
                  <p className="memo-bubble-quote">"{activeMemo.selectedText}"</p>
                )}

                <div className="memo-bubble-body">
                  {editingMemo === activeMemo.id ? (
                    <>
                      <textarea
                        className="memo-textarea"
                        value={memoNote}
                        onChange={(e) => setMemoNote(e.target.value)}
                        rows={4}
                        autoFocus
                      />
                      <div className="memo-popup-actions">
                        <button className="highlight-popup-btn" onClick={async () => {
                          try {
                            await editMemo(activeMemo.id, memoNote.trim(), getToken());
                            setActiveMemo(null); setBubblePos(null); setEditingMemo(null); setMemoNote('');
                            setTimeout(() => showMemoToast('메모가 수정되었습니다'), 0);
                          } catch (err) {
                            setTimeout(() => showMemoToast('메모 수정 실패', 'error'), 0);
                          }
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
                            } catch (err) {
                              setTimeout(() => showMemoToast('메모 삭제 실패', 'error'), 0);
                            }
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

        {(prev || next) && (
          <nav className={`chapter-nav${prev && next ? ' has-both' : ''}`}>
            {prev && (
              <button
                className="chapter-nav-btn prev"
                onClick={() => navigate(`/${lang}/book/${bookSlug}/read/${prev.path}`)}
              >
                <FiChevronLeft size={18} />
                <div className="chapter-nav-text">
                  <span className="chapter-nav-label">{t('chapter.prev')}</span>
                  <span className="chapter-nav-title">{prev.name}</span>
                </div>
              </button>
            )}
            {next && (
              <button
                className="chapter-nav-btn next"
                onClick={() => navigate(`/${lang}/book/${bookSlug}/read/${next.path}`)}
              >
                <div className="chapter-nav-text">
                  <span className="chapter-nav-label">{t('chapter.next')}</span>
                  <span className="chapter-nav-title">{next.name}</span>
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
            term={`book/${bookSlug}/read/${chapterPath}`}
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

export default Chapter;
