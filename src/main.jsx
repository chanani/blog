import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import App from './App.jsx';
import i18n from './i18n/index.js';
import './styles/common.css';
import './App.css';

createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </HelmetProvider>,
);
