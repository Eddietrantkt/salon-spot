import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { AuthenticationResponse, ProfessionalProfile } from '@salon-spot/contracts';
import { ApiRequestError } from '../../../shared/api/http';
import { refreshSession } from '../../auth/api/auth-api';
import { getProfessionalProfile, updateProfessionalProfile } from '../api/professional-profile-api';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';

interface ProfessionalOnboardingPageProps {
  initialSession: AuthenticationResponse | null;
  onSessionRestored: (session: AuthenticationResponse) => void;
  onSessionEnded: () => void;
}

export function ProfessionalOnboardingPage({ initialSession, onSessionRestored, onSessionEnded }: ProfessionalOnboardingPageProps): JSX.Element {
  const { t } = useI18n();
  const [auth, setAuth] = useState<AuthenticationResponse | null>(initialSession);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef<Promise<AuthenticationResponse> | null>(null);

  useEffect(() => { if (auth) void loadProfile(auth.accessToken); else void restore(); }, []);

  async function restore(): Promise<void> {
    try {
      const session = await refreshSessionOnce();
      setAuth(session);
      onSessionRestored(session);
      await loadProfile(session.accessToken);
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 401) onSessionEnded(); else setError(localizedErrorMessage(reason, t));
    } finally { setIsLoading(false); }
  }

  async function refreshSessionOnce(): Promise<AuthenticationResponse> {
    if (!refreshInFlight.current) refreshInFlight.current = refreshSession().finally(() => { refreshInFlight.current = null; });
    return refreshInFlight.current;
  }

  async function loadProfile(accessToken: string): Promise<void> {
    setIsLoading(true);
    try { applyProfile(await getProfessionalProfile(accessToken)); }
    catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsLoading(false); }
  }

  function applyProfile(next: ProfessionalProfile): void {
    setProfile(next);
    setPhone(next.phone ?? '');
    setCity(next.city ?? '');
    setBio(next.bio ?? '');
    setSpecialties(next.specialties.join(', '));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!auth) return;
    setIsSaving(true); setError(null);
    try {
      const input = {
        phone: phone.trim(),
        city: city.trim(),
        bio: bio.trim(),
        specialties: Array.from(new Set(specialties.split(',').map((item) => item.trim()).filter(Boolean)))
      };
      applyProfile(await updateProfessionalProfile(auth.accessToken, input));
    } catch (reason) { setError(localizedErrorMessage(reason, t)); }
    finally { setIsSaving(false); }
  }

  return <main className="page-shell professional-shell">
    <header className="page-heading"><div><p className="eyebrow">{t('PROFESSIONAL ONBOARDING', 'HỒ SƠ CHUYÊN VIÊN')}</p><h1>{t('Tell salons about your work', 'Giới thiệu công việc của bạn với salon')}</h1><p className="lead">{t('Complete the details below. Your account remains pending until the Professional access review is completed.', 'Hoàn thành thông tin bên dưới. Tài khoản vẫn ở trạng thái chờ cho đến khi quá trình xét duyệt Chuyên viên hoàn tất.')}</p></div>{profile && <span className={`status-badge professional-status-${profile.status.toLowerCase()}`}>{professionalStatus(profile.status, t)}</span>}</header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {isLoading ? <p className="notice" role="status">{t('Loading your Professional profile…', 'Đang tải hồ sơ Chuyên viên…')}</p> : !auth ? <section className="auth-card"><h2>{t('Sign in to continue', 'Đăng nhập để tiếp tục')}</h2><p className="lead">{t('Your Professional onboarding is available after you sign in.', 'Bạn có thể hoàn thiện hồ sơ Chuyên viên sau khi đăng nhập.')}</p></section> : profile && <section className="auth-card"><div><p className="eyebrow">{t('YOUR PROFILE', 'HỒ SƠ CỦA BẠN')}</p><h2>{t('Professional details', 'Thông tin Chuyên viên')}</h2></div><form className="owner-form" onSubmit={submit}><label>{t('Phone number', 'Số điện thoại')}<input autoComplete="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>{t('City or area', 'Thành phố hoặc khu vực')}<input autoComplete="address-level2" maxLength={120} value={city} onChange={(event) => setCity(event.target.value)} /></label><label>{t('Specialties', 'Chuyên môn')} <small>{t('Separate with commas', 'Phân cách bằng dấu phẩy')}</small><input maxLength={720} value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder={t('Hair styling, nails, makeup', 'Tạo mẫu tóc, làm móng, trang điểm')} /></label><label>{t('About your work', 'Giới thiệu công việc')}<textarea rows={5} maxLength={1000} value={bio} onChange={(event) => setBio(event.target.value)} /></label><button disabled={isSaving} type="submit">{isSaving ? t('Saving…', 'Đang lưu…') : t('Save Professional profile', 'Lưu hồ sơ Chuyên viên')}</button></form></section>}
  </main>;
}

function professionalStatus(status: ProfessionalProfile['status'], t: (english: string, vietnamese: string) => string): string {
  if (status === 'PENDING') return t('PENDING', 'ĐANG CHỜ');
  if (status === 'ACTIVE') return t('ACTIVE', 'HOẠT ĐỘNG');
  return t('SUSPENDED', 'TẠM KHÓA');
}
