import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import './Dashboard.css';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1], delay },
});

function Dashboard() {
  useEffect(() => {
    document.body.classList.add('hero-page');
    return () => document.body.classList.remove('hero-page');
  }, []);

  return (
    <main className="hero">
      <Helmet>
        <title>chanani</title>
        <meta name="description" content="꿈꾸고, 개발하며, 기록하는 백엔드 개발자 이찬한의 블로그입니다." />
        <meta property="og:title" content="chanani." />
        <meta property="og:description" content="꿈꾸고, 개발하며, 기록하는 백엔드 개발자 이찬한의 블로그입니다." />
        <link rel="canonical" href="https://chanhan.blog/" />
      </Helmet>

      <div className="hero-inner">
        <div className="hero-text">
          <h1>
            <motion.span className="hero-line" {...fadeUp(0)}>Don't find</motion.span>
            <motion.span className="hero-line" {...fadeUp(0.18)}>the fault,</motion.span>
            <motion.span className="hero-line" {...fadeUp(0.36)}>find the remedy.</motion.span>
          </h1>
        </div>

        <motion.div className="hero-info" {...fadeUp(0.55)}>
          <div className="hero-info-item">
            <span className="hero-info-label">LOCATION</span>
            <span className="hero-info-value">Seoul, Korea</span>
          </div>
          <div className="hero-info-item">
            <span className="hero-info-label">ROLE</span>
            <span className="hero-info-value">Backend Developer</span>
          </div>
          <div className="hero-info-item">
            <span className="hero-info-label">CONTACT</span>
            <span className="hero-info-value">theholidaynight@gmail.com</span>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

export default Dashboard;
