import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiSun, FiMoon, FiMenu, FiX, FiChevronDown } from 'react-icons/fi';
import { useLang } from '../../../hooks/useLang';
import './Header.css';

const LANG_OPTIONS = [
  { value: 'ko', short: 'KO' },
  { value: 'en', short: 'EN' },
  { value: 'ja', short: 'JP' },
];

function LangDropdown({ lang, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANG_OPTIONS.find((o) => o.value === lang) || LANG_OPTIONS[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="lang-dropdown" ref={ref}>
      <button
        className={`lang-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="언어 선택"
      >
        <span className="lang-trigger-short">{current.short}</span>
        <FiChevronDown size={10} className={`lang-chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <div className="lang-menu">
          {LANG_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`lang-option${lang === opt.value ? ' active' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.short}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV_PATHS = [
  { path: 'about', labelKey: 'nav.about' },
  { path: 'posts', labelKey: 'nav.blog' },
  { path: 'books', labelKey: 'nav.books' },
  { path: 'guestbook', labelKey: 'nav.guestbook' },
];

function Header({ theme, toggleTheme }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const lang = useLang();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => {
    const base = `/${lang}/${path}`;
    if (path === 'posts') return pathname === base || pathname.startsWith(`/${lang}/post/`);
    if (path === 'books') return pathname === base || pathname.startsWith(`/${lang}/book/`) || pathname === `/${lang}/books/reading`;
    return pathname === base;
  };

  const handleLangChange = (newLang) => {
    const segments = pathname.split('/');
    segments[1] = newLang;
    navigate(segments.join('/') || `/${newLang}`);
  };

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    document.body.classList.toggle('menu-open', menuOpen);
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('menu-open');
    };
  }, [menuOpen]);

  return (
    <header className="header">
      <div className="header-inner">
        <Link to={`/${lang}`} className="header-logo">chanani</Link>

        <div className="header-right">
          <nav className="header-nav">
            {NAV_PATHS.map((link) => (
              <Link
                key={link.path}
                to={`/${lang}/${link.path}`}
                className={`header-nav-link${isActive(link.path) ? ' active' : ''}`}
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <LangDropdown lang={lang} onChange={handleLangChange} />
            <button className="header-icon-btn" onClick={toggleTheme} aria-label="테마 전환">
              {theme === 'light' ? <FiMoon size={15} /> : <FiSun size={15} />}
            </button>
            <button
              className="header-icon-btn mobile-only"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="메뉴"
            >
              {menuOpen ? <FiX size={18} /> : <FiMenu size={18} />}
            </button>
          </div>
        </div>
      </div>

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <nav className="mobile-nav">
          {NAV_PATHS.map((link, i) => (
            <Link
              key={link.path}
              to={`/${lang}/${link.path}`}
              className={`mobile-nav-link${isActive(link.path) ? ' active' : ''}`}
              style={{ animationDelay: `${0.04 + i * 0.06}s` }}
              onClick={() => setMenuOpen(false)}
            >
              <span className="mobile-nav-index">0{i + 1}</span>
              <span className="mobile-nav-label">{t(link.labelKey)}</span>
            </Link>
          ))}
        </nav>
        <div className="mobile-menu-footer">
          <div className="mobile-lang-wrap">
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`mobile-lang-btn${lang === opt.value ? ' active' : ''}`}
                onClick={() => { handleLangChange(opt.value); setMenuOpen(false); }}
              >
                {opt.short}
              </button>
            ))}
            <button
              className="mobile-lang-btn mobile-theme-btn"
              onClick={() => { toggleTheme(); setMenuOpen(false); }}
              aria-label="테마 전환"
            >
              {theme === 'light' ? <FiMoon size={14} /> : <FiSun size={14} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
