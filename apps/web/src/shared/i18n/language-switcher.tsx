import type { JSX } from 'react';
import { useI18n } from './i18n-provider';

export function LanguageSwitcher(): JSX.Element {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="language-switcher" role="group" aria-label={t('Choose language', 'Chọn ngôn ngữ')}>
      <button className={locale === 'en' ? 'language-active' : ''} type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')} lang="en">EN</button>
      <button className={locale === 'vi' ? 'language-active' : ''} type="button" aria-pressed={locale === 'vi'} onClick={() => setLocale('vi')} lang="vi">VI</button>
    </div>
  );
}
