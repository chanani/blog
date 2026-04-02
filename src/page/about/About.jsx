import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { FiGithub, FiLinkedin, FiMail } from 'react-icons/fi';
import { SiTistory } from 'react-icons/si';
import './About.css';

const SOCIAL_LINKS = [
  {
    href: 'https://github.com/chanani',
    icon: <FiGithub size={16} />,
    label: 'GitHub',
  },
  {
    href: 'https://chanhan.tistory.com/',
    icon: <SiTistory size={14} />,
    label: 'Tistory',
  },
  {
    href: 'https://www.linkedin.com/in/%25EC%25B0%25AC%25ED%2595%259C-%25EC%259D%25B4-1648a6294/?skipRedirect=true',
    icon: <FiLinkedin size={16} />,
    label: 'LinkedIn',
  },
  {
    href: 'mailto:theholidaynight@gmail.com',
    icon: <FiMail size={16} />,
    label: 'Email',
  },
];

function About() {
  const { t } = useTranslation();

  return (
    <main className="about">
      <Helmet>
        <title>소개 — chanani</title>
        <meta name="description" content="주도적으로 문제를 발견하고 해결하는 백엔드 개발자 이찬한입니다." />
        <meta property="og:title" content="소개 — chanani" />
        <meta property="og:description" content="주도적으로 문제를 발견하고 해결하는 백엔드 개발자 이찬한입니다." />
        <link rel="canonical" href="https://chanhan.blog/about" />
      </Helmet>

      <div className="about-inner">
        <div className="about-profile">
          <img src="/profile.jpg" alt="이찬한" className="about-avatar" />
          <div className="about-profile-info">
            <h1 className="about-name">이찬한</h1>
            <p className="about-role">{t('about.role')}</p>
          </div>
        </div>

        <div className="about-body">
          <p>{t('about.p1')}</p>
          <p>{t('about.p2')}</p>
          <p>{t('about.p3')}</p>
          <p>
            {t('about.p4_prefix')}
            <em>{t('about.p4_em')}</em>
            {t('about.p4_suffix')}
          </p>
          <p>{t('about.p5')}</p>
        </div>

        <div className="about-social">
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="about-social-link"
            >
              {link.icon}
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}

export default About;
