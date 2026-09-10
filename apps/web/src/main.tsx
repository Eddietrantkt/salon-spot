import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { I18nProvider } from './shared/i18n/i18n-provider';
import './styles.css';
import './shared/design-tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider><App /></I18nProvider>
  </StrictMode>
);
