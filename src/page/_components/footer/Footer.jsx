import { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiGithub, FiLinkedin, FiMail } from 'react-icons/fi';
import { useAuth } from '../../../context/AuthContext';
import './Footer.css';

function Footer() {
  const navigate = useNavigate();
  const { authenticated } = useAuth();
  const clickCount = useRef(0);
  const clickTimer = useRef(null);

  const handleSecretClick = useCallback(() => {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      navigate('/admin');
      return;
    }
    clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 2000);
  }, [navigate]);

  return (
    <footer className="footer">
      <div className="footer-inner">
        <p
          className={`footer-copy${authenticated ? ' footer-copy--admin' : ''}`}
          onClick={handleSecretClick}
        >
          © 2026. chanani all rights reserved.
        </p>
        <div className="footer-links">
          <a href="https://github.com/chanani" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <FiGithub size={17} />
          </a>
          <a href="https://www.linkedin.com/in/%EC%B0%AC%ED%95%9C-%EC%9D%B4-1648a6294/?skipRedirect=true" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <FiLinkedin size={17} />
          </a>
          <a href="mailto:theholidaynight@gmail.com" aria-label="Mail">
            <FiMail size={17} />
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
