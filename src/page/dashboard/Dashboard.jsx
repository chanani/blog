import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import './Dashboard.css';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1], delay },
});

const charHover = {
  type: 'spring',
  stiffness: 500,
  damping: 22,
};

function AnimatedLine({ text }) {
  return (
    <>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
          whileHover={{ y: -10, transition: charHover }}
        >
          {char}
        </motion.span>
      ))}
    </>
  );
}

function Dashboard() {
  const { t } = useTranslation();

  useEffect(() => {
    document.body.classList.add('hero-page');
    return () => document.body.classList.remove('hero-page');
  }, []);

  return (
    <main className="hero">
      <Helmet>
        <title>chanani</title>
        <meta name="description" content="꿈꾸고, 개발하며, 기록하는 백엔드 개발자 이찬한의 블로그입니다." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://chanhan.blog/" />
        <meta property="og:title" content="chanani." />
        <meta property="og:description" content="꿈꾸고, 개발하며, 기록하는 백엔드 개발자 이찬한의 블로그입니다." />
        <meta property="og:image" content="https://chanhan.blog/profile.png" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="chanani." />
        <meta name="twitter:description" content="꿈꾸고, 개발하며, 기록하는 백엔드 개발자 이찬한의 블로그입니다." />
        <meta name="twitter:image" content="https://chanhan.blog/profile.png" />
        <link rel="canonical" href="https://chanhan.blog/" />
      </Helmet>

      <div className="hero-inner">
        <div className="hero-text">
          <h1>
            <motion.span className="hero-line" {...fadeUp(0)}><AnimatedLine text={t('hero.line1')} /></motion.span>
            <motion.span className="hero-line" {...fadeUp(0.18)}><AnimatedLine text={t('hero.line2')} /></motion.span>
            <motion.span className="hero-line" {...fadeUp(0.36)}><AnimatedLine text={t('hero.line3')} /></motion.span>
          </h1>
        </div>

        <motion.div className="hero-info" {...fadeUp(0.55)}>
          <div className="hero-info-item">
            <span className="hero-info-label">{t('hero.locationLabel')}</span>
            <span className="hero-info-value">{t('hero.locationValue')}</span>
          </div>
          <div className="hero-info-item">
            <span className="hero-info-label">{t('hero.roleLabel')}</span>
            <span className="hero-info-value">{t('hero.roleValue')}</span>
          </div>
          <div className="hero-info-item">
            <span className="hero-info-label">{t('hero.contactLabel')}</span>
            <span className="hero-info-value">theholidaynight@gmail.com</span>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

export default Dashboard;
