import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiMoon, FiSun } from 'react-icons/fi';
import Router from './routes/Router';
import Header from './page/_components/header/Header';
import Footer from './page/_components/footer/Footer';
import { AuthProvider } from './context/AuthContext';
import usePageView from './hooks/usePageView';

function AppInner({ theme, toggleTheme }) {
  const { i18n } = useTranslation();
  const [transitioning, setTransitioning] = useState(false);
  const prevLang = useRef(i18n.language);
  const location = useLocation();
  // /:lang (index) = 대시보드(메인). 세그먼트가 언어코드 1개뿐이면 홈
  const isHomePage = location.pathname.split('/').filter(Boolean).length === 1;
  usePageView();

  useEffect(() => {
    if (prevLang.current !== i18n.language) {
      prevLang.current = i18n.language;
      setTransitioning(true);
      const timer = setTimeout(() => setTransitioning(false), 380);
      return () => clearTimeout(timer);
    }
  }, [i18n.language]);

  return (
    <div className="app">
      <Header theme={theme} toggleTheme={toggleTheme} />
      <div className={transitioning ? 'lang-transition' : undefined} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Router />
        <Footer />
      </div>
      {!isHomePage && (
        <button className="theme-toggle-float" onClick={toggleTheme} aria-label="테마 전환">
          {theme === 'light' ? <FiMoon size={22} /> : <FiSun size={22} />}
        </button>
      )}
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppInner theme={theme} toggleTheme={toggleTheme} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
