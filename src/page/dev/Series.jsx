import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiChevronRight } from 'react-icons/fi';
import useDevStore from '../../store/useDevStore';
import { useLang } from '../../hooks/useLang';
import { useTranslation } from 'react-i18next';
import defaultCover from '../../assets/images/default/default.png';
import './Series.css';

function Series() {
  const { category, seriesSlug } = useParams();
  const navigate = useNavigate();
  const lang = useLang();
  const { t } = useTranslation();
  const { currentSeries, loading, error, loadSeries, clearSeries } = useDevStore();
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    loadSeries(category, seriesSlug);
    return () => clearSeries();
  }, [category, seriesSlug, loadSeries, clearSeries]);

  if (loading) {
    return (
      <main className="series-page">
        <div className="page-loading">
          <img src="/profile.jpg" alt="이찬한" className="loading-avatar" />
          <p className="loading-text">시리즈를 불러오는 중...</p>
          <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
        </div>
      </main>
    );
  }

  if (error || !currentSeries) {
    return (
      <main className="series-page">
        <div className="series-wrap">
          <div className="series-status">
            <p>시리즈를 불러오지 못했습니다.</p>
            <button className="series-back-btn" onClick={() => navigate(`/${lang}/posts`)}>
              목록으로
            </button>
          </div>
        </div>
      </main>
    );
  }

  const { title, description, status, cover, tags, episodes = [] } = currentSeries;

  return (
    <main className="series-page">
      <Helmet>
        <title>{title} 시리즈 — chanani</title>
        <meta name="description" content={description || `${title} 시리즈`} />
      </Helmet>
      <motion.div
        className="series-wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <button className="back-link" onClick={() => navigate(`/${lang}/posts`)}>
          <FiArrowLeft size={16} />
          <span>블로그 목록</span>
        </button>

        {/* Series Info */}
        <section className="series-info-section">
          <div className="series-cover">
            {!imgError && cover ? (
              <img src={cover} alt={title} onError={() => setImgError(true)} />
            ) : (
              <div className="series-cover-fallback">
                <span>📚</span>
              </div>
            )}
          </div>
          <div className="series-info-detail">
            <div className="series-info-top">
              <span className="series-cat-badge">{category}</span>
              <span className="series-ep-total">{episodes.length}편</span>
            </div>
            <h1 className="series-title">{title}</h1>
            {description && <p className="series-desc">{description}</p>}
            {tags && tags.length > 0 && (
              <div className="series-tags">
                {tags.map((tag) => (
                  <span key={tag} className="series-tag">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Episode List */}
        <section className="series-ep-section">
          <div className="series-ep-header">
            <h2 className="series-ep-title">에피소드 목록</h2>
            <span className="series-ep-count-badge">{episodes.length}편</span>
          </div>
          {episodes.length === 0 ? (
            <p className="series-ep-empty">아직 에피소드가 없습니다.</p>
          ) : (
            <div className="series-ep-list">
              {episodes.map((ep, i) => (
                <Link
                  key={ep.slug}
                  to={`/${lang}/post/${category}/${seriesSlug}/${ep.slug}`}
                  className="series-ep-item"
                >
                  <span className="series-ep-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="series-ep-name">{ep.title}</span>
                  <div className="series-ep-right">
                    {ep.date && Date.now() - new Date(ep.date).getTime() < 3 * 24 * 60 * 60 * 1000 && (
                      <span className="series-ep-new">NEW</span>
                    )}
                    <FiChevronRight size={16} className="series-ep-arrow" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </motion.div>
    </main>
  );
}

export default Series;
