import { Helmet } from 'react-helmet-async';
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
            <p className="about-role">Backend Developer · Seoul, Korea</p>
          </div>
        </div>

        <div className="about-body">
          <p>
            안녕하세요, 백엔드 개발자 이찬한입니다. 누군가 알려주기를 기다리기보다
            먼저 문제를 발견하고, 끝까지 해결하는 개발자가 되는 것을 목표로 하고 있습니다.
          </p>
          <p>
            이 블로그는 배운 것을 기록하고 생각을 정리하는 공간입니다. 코드 한 줄,
            책 한 페이지에서 얻은 인사이트를 차곡차곡 쌓아가고 있습니다. 기록하지
            않으면 결국 사라진다고 생각하기 때문에, 작더라도 꾸준히 남기려 합니다.
          </p>
          <p>
            많은 분들의 도움을 받으며 성장하면서, 자연스럽게 어떤 개발자가 되고 싶은지
            생각하게 되었습니다. 기술적으로 뛰어난 것도 중요하지만, 도움이 필요한 개발자가
            있다면 망설임 없이 손 내밀 수 있는 사람이 되고 싶습니다. 받은 도움을 다시
            나눌 수 있는 개발자로 성장하는 것이 지금의 목표 중 하나입니다.
          </p>
          <p>
            요즘은 <em>'왜?'</em>라는 질문을 더 자주 하려고 합니다. 그동안 '어떻게'에
            집중하다 보니, 정작 왜 이 방법을 선택했는지에 대한 고민이 부족했습니다.
            근거 없는 선택은 쌓이다 보면 결국 무너지더라고요. 모든 결정에 이유를 말할 수
            있는 개발자로 성장하는 것이 지금의 목표입니다.
          </p>
          <p>
            아직 배울 것이 많고, 여전히 성장하는 과정 중에 있습니다. 이 공간이 저와
            방문해주신 분들 모두에게 작은 영감이 되길 바랍니다.
          </p>
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
