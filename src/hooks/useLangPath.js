import { useLang } from './useLang';

export function useLangPath() {
  const lang = useLang();
  return (path) => `/${lang}${path.startsWith('/') ? path : '/' + path}`;
}
