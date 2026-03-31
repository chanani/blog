import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import './Dashboard.css';

function Dashboard() {
  useEffect(() => {
    document.body.classList.add('hero-page');
    return () => document.body.classList.remove('hero-page');
  }, []);

  return (
    <main className="hero">
      <Helmet>
        <title>chanani.</title>
        <meta name="description" content="꿈꾸고, 개발하며, 기록하는 백엔드 개발자 이찬한의 블로그입니다." />
        <meta property="og:title" content="chanani." />
        <meta property="og:description" content="꿈꾸고, 개발하며, 기록하는 백엔드 개발자 이찬한의 블로그입니다." />
        <link rel="canonical" href="https://chanhan.blog/" />
      </Helmet>

      <div className="hero-inner">
        <div className="hero-text">
          <h1>
            <span className="hero-line">Write code.</span>
            <span className="hero-line">Read books.</span>
            <span className="hero-line">Stay curious.</span>
          </h1>
        </div>

        <div className="hero-info">
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
        </div>
      </div>
    </main>
  );
}

export default Dashboard;
