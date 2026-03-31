import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Giscus from '@giscus/react';
import './Guestbook.css';

function Guestbook() {
  const [giscusTheme, setGiscusTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light',
  );

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

  return (
    <main className="guestbook-page">
      <Helmet>
        <title>guestbook — chanani.</title>
        <meta name="description" content="chanani의 방명록입니다. 자유롭게 글을 남겨주세요." />
        <link rel="canonical" href="https://chanhan.blog/guestbook" />
      </Helmet>

      <div className="guestbook-hero">
        <div className="guestbook-hero-inner">
          <h1 className="guestbook-title">Guestbook</h1>
          <p className="guestbook-desc">방문해주셔서 감사합니다. 자유롭게 글을 남겨주세요 👋</p>
        </div>
      </div>

      <div className="guestbook-body">
        <section className="guestbook-comments">
          <Giscus
            repo="chanani/blog"
            repoId="R_kgDORI3Ksw"
            category="Announcements"
            categoryId="DIC_kwDORI3Ks84C15da"
            mapping="specific"
            term="guestbook"
            reactionsEnabled="0"
            emitMetadata="0"
            inputPosition="top"
            theme={`https://chanhan.blog/giscus-${giscusTheme}.css?v=5`}
            lang="ko"
          />
        </section>
      </div>
    </main>
  );
}

export default Guestbook;
