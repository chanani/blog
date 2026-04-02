import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Dashboard from '../page/dashboard/Dashboard';

const DevHome = lazy(() => import('../page/dev/DevHome'));
const DevPost = lazy(() => import('../page/dev/DevPost'));
const Home = lazy(() => import('../page/home/Home'));
const Book = lazy(() => import('../page/book/Book'));
const Chapter = lazy(() => import('../page/chapter/Chapter'));
const Reading = lazy(() => import('../page/reading/Reading'));
const About = lazy(() => import('../page/about/About'));
const Guestbook = lazy(() => import('../page/guestbook/Guestbook'));
const Admin = lazy(() => import('../page/admin/Admin'));
const NotFound = lazy(() => import('../page/notfound/NotFound'));

const VALID_LANGS = ['ko', 'en', 'ja'];

function RootRedirect() {
  const browserLang = navigator.language.split('-')[0];
  const lang = VALID_LANGS.includes(browserLang) ? browserLang : 'ko';
  return <Navigate to={`/${lang}`} replace />;
}

function LangWrapper() {
  const { lang } = useParams();
  const { i18n } = useTranslation();

  if (!VALID_LANGS.includes(lang)) {
    return <Navigate to="/ko" replace />;
  }

  // Resources are pre-loaded, so changeLanguage is synchronous.
  // Calling it during render ensures children always mount with the correct language.
  if (i18n.language !== lang) {
    i18n.changeLanguage(lang);
  }

  return <Outlet />;
}

function LoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="page-loading">
      <img src="/profile.jpg" alt="이찬한" className="loading-avatar" />
      <p className="loading-text">{t('loading.page')}</p>
      <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/:lang" element={<LangWrapper />}>
          <Route index element={<Dashboard />} />
          <Route path="posts" element={<DevHome />} />
          <Route path="post/:category/:slug" element={<DevPost />} />
          <Route path="books" element={<Home />} />
          <Route path="books/reading" element={<Reading />} />
          <Route path="about" element={<About />} />
          <Route path="guestbook" element={<Guestbook />} />
          <Route path="book/:bookSlug" element={<Book />} />
          <Route path="book/:bookSlug/read/*" element={<Chapter />} />
        </Route>
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default Router;
