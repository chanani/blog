import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiHome, FiArrowLeft } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../hooks/useLang';
import './NotFound.css';

function NotFound() {
  const navigate = useNavigate();
  const lang = useLang();
  const { t } = useTranslation();

  return (
    <main className="notfound-page">
      <Helmet>
        <title>404 - 차나니의 책방</title>
        <meta name="description" content="페이지를 찾을 수 없습니다." />
      </Helmet>
      <div className="notfound-content">
        <span className="notfound-code">404</span>
        <h1 className="notfound-title">{t('notfound.title')}</h1>
        <p className="notfound-desc">{t('notfound.desc')}</p>
        <div className="notfound-actions">
          <button className="notfound-btn secondary" onClick={() => navigate(-1)}>
            <FiArrowLeft size={16} />
            <span>{t('notfound.back')}</span>
          </button>
          <button className="notfound-btn primary" onClick={() => navigate(`/${lang}`)}>
            <FiHome size={16} />
            <span>{t('notfound.home')}</span>
          </button>
        </div>
      </div>
    </main>
  );
}

export default NotFound;
