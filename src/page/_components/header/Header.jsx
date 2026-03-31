import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiSun, FiMoon, FiMenu, FiX } from 'react-icons/fi';
import './Header.css';

const NAV_LINKS = [
  { to: '/posts', label: 'blog' },
  { to: '/books', label: 'books' },
  { to: '/guestbook', label: 'guestbook' },
  { to: '/about', label: 'about' },
];

function Header({ theme, toggleTheme }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (to) => {
    if (to === '/posts') return pathname === '/posts' || pathname.startsWith('/post/');
    if (to === '/books') return pathname === '/books' || pathname.startsWith('/book/');
    return pathname === to;
  };

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="header-logo">chanani.</Link>

        <nav className="header-nav">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`header-nav-link${isActive(link.to) ? ' active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <button className="header-icon-btn" onClick={toggleTheme} aria-label="테마 전환">
            {theme === 'light' ? <FiMoon size={15} /> : <FiSun size={15} />}
          </button>
          <button
            className="header-icon-btn mobile-only"
            onClick={() => setMenuOpen(true)}
            aria-label="메뉴"
          >
            <FiMenu size={18} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />
      )}

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <button className="mobile-menu-close" onClick={() => setMenuOpen(false)} aria-label="닫기">
          <FiX size={20} />
        </button>
        <nav className="mobile-nav">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`mobile-nav-link${isActive(link.to) ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button className="mobile-theme-btn" onClick={toggleTheme}>
          {theme === 'light' ? <FiMoon size={14} /> : <FiSun size={14} />}
          {theme === 'light' ? 'dark mode' : 'light mode'}
        </button>
      </div>
    </header>
  );
}

export default Header;
