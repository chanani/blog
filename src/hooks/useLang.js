import { useLocation } from 'react-router-dom';

const VALID_LANGS = ['ko', 'en', 'ja'];

export function useLang() {
  const { pathname } = useLocation();
  const segment = pathname.split('/')[1];
  return VALID_LANGS.includes(segment) ? segment : 'ko';
}
