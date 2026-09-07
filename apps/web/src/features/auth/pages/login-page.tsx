import { useState, type FormEvent, type JSX } from 'react';
import type { RegistrationIntent } from '@salon-spot/contracts';
import type { AuthenticationResponse } from '@salon-spot/contracts';
import { buildAuthenticationRequest, type AuthenticationMode } from '../auth-request';
import { login, register } from '../api/auth-api';
import { useI18n } from '../../../shared/i18n/i18n-provider';
import { localizedErrorMessage } from '../../../shared/i18n/localized-error-message';

export type LoginDestination = 'booking' | 'my-bookings' | 'owner' | 'admin' | 'explore';

interface LoginPageProps {
  destination: LoginDestination;
  onAuthenticated: (session: AuthenticationResponse, registrationIntent?: RegistrationIntent) => void;
  onBack: () => void;
}

const destinationCopy: Record<LoginDestination, { eyebrow: [string, string]; title: [string, string]; description: [string, string] }> = {
  booking: { eyebrow: ['RESERVE A WORKSPACE', 'ĐẶT KHÔNG GIAN'], title: ['Sign in to reserve a time', 'Đăng nhập để đặt khung giờ'], description: ['Use one account to hold and manage your workspace bookings.', 'Dùng một tài khoản để giữ chỗ và quản lý lịch đặt không gian.'] },
  'my-bookings': { eyebrow: ['MY BOOKINGS', 'LỊCH ĐẶT CỦA TÔI'], title: ['Sign in to view your bookings', 'Đăng nhập để xem lịch đặt'], description: ['Review upcoming sessions, booking status and permitted cancellations.', 'Xem các buổi sắp tới, trạng thái lịch đặt và các trường hợp được phép hủy.'] },
  owner: { eyebrow: ['OWNER CONSOLE', 'KHU VỰC CHỦ SALON'], title: ['Sign in to manage your salon', 'Đăng nhập để quản lý salon'], description: ['Create and publish workspaces, then manage their availability.', 'Tạo và công bố không gian, sau đó quản lý lịch trống.'] },
  admin: { eyebrow: ['OPERATIONS', 'VẬN HÀNH'], title: ['Admin sign in', 'Đăng nhập quản trị'], description: ['Admin access is granted by the operations team after your account has been created.', 'Quyền quản trị được đội ngũ vận hành cấp sau khi tài khoản được tạo.'] },
  explore: { eyebrow: ['YOUR ACCOUNT', 'TÀI KHOẢN CỦA BẠN'], title: ['Welcome back', 'Chào mừng bạn trở lại'], description: ['Sign in once to manage bookings or your salon workspace.', 'Đăng nhập để quản lý lịch đặt hoặc không gian salon của bạn.'] }
};

export function LoginPage({ destination, onAuthenticated, onBack }: LoginPageProps): JSX.Element {
  const { t } = useI18n();
  const [mode, setMode] = useState<AuthenticationMode>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [onboardingIntent, setOnboardingIntent] = useState<RegistrationIntent>('PROFESSIONAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = destinationCopy[destination];

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const request = buildAuthenticationRequest(mode, { email, displayName, password, onboardingIntent });
    try {
      const session = request.mode === 'login' ? await login(request.input) : await register(request.input);
      onAuthenticated(session, request.mode === 'register' ? onboardingIntent : undefined);
    } catch (reason) {
      setError(localizedErrorMessage(reason, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="page-shell auth-shell">
    <button className="text-button" type="button" onClick={onBack}>← {t('Back to explore', 'Quay lại khám phá')}</button>
    <section className="auth-layout" aria-labelledby="login-heading">
      <div className="auth-introduction">
        <p className="eyebrow">{t(...copy.eyebrow)}</p>
        <h1 id="login-heading">{mode === 'login' ? t(...copy.title) : t('Create your account', 'Tạo tài khoản')}</h1>
        <p className="lead">{mode === 'login' ? t(...copy.description) : t('Choose the journey you want to start. You can later add another capability to the same account.', 'Chọn hành trình bạn muốn bắt đầu. Sau này bạn có thể thêm vai trò khác vào cùng tài khoản.')}</p>
        <ul className="auth-benefits">
          <li>{t('Your password is protected by the server; it is never stored in the browser.', 'Mật khẩu được máy chủ bảo vệ và không bao giờ được lưu trong trình duyệt.')}</li>
          <li>{t('Your session can be safely restored using a secure refresh cookie.', 'Phiên đăng nhập có thể được khôi phục an toàn bằng cookie bảo mật.')}</li>
          <li>{t('Creating a salon grants Owner access for that salon. Professional access stays pending until activated.', 'Khi tạo salon, bạn được cấp quyền Chủ salon cho salon đó. Quyền Chuyên viên vẫn chờ cho đến khi được kích hoạt.')}</li>
        </ul>
      </div>
      <section className="auth-card" aria-label={mode === 'login' ? t('Sign in form', 'Biểu mẫu đăng nhập') : t('Registration form', 'Biểu mẫu đăng ký')}>
        <div className="section-heading">
          <div><p className="eyebrow">{mode === 'login' ? t('SIGN IN', 'ĐĂNG NHẬP') : t('CREATE ACCOUNT', 'TẠO TÀI KHOẢN')}</p><h2>{mode === 'login' ? t('Continue with your account', 'Tiếp tục với tài khoản') : t('Start with one account', 'Bắt đầu với một tài khoản')}</h2></div>
          <button className="text-button" type="button" onClick={() => { setMode((current) => current === 'login' ? 'register' : 'login'); setError(null); }}>
            {mode === 'login' ? t('Create account', 'Tạo tài khoản') : t('Sign in instead', 'Chuyển sang đăng nhập')}
          </button>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <form className="owner-form" onSubmit={submit}>
          {mode === 'register' && <label>{t('Full name', 'Họ và tên')}<input required autoComplete="name" maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>}
          {mode === 'register' && <fieldset className="role-picker"><legend>{t('How would you like to start?', 'Bạn muốn bắt đầu với vai trò nào?')}</legend><label className={onboardingIntent === 'PROFESSIONAL' ? 'role-choice role-choice-selected' : 'role-choice'}><input type="radio" name="onboardingIntent" value="PROFESSIONAL" checked={onboardingIntent === 'PROFESSIONAL'} onChange={() => setOnboardingIntent('PROFESSIONAL')} /><span><strong>{t('Beauty Professional', 'Chuyên viên làm đẹp')}</strong><small>{t('Build your profile first. Booking access is activated after review.', 'Hoàn thiện hồ sơ trước. Quyền đặt chỗ được kích hoạt sau khi duyệt.')}</small></span></label><label className={onboardingIntent === 'OWNER' ? 'role-choice role-choice-selected' : 'role-choice'}><input type="radio" name="onboardingIntent" value="OWNER" checked={onboardingIntent === 'OWNER'} onChange={() => setOnboardingIntent('OWNER')} /><span><strong>{t('Salon Owner', 'Chủ salon')}</strong><small>{t('Set up your first salon and workspace after account creation.', 'Thiết lập salon và không gian đầu tiên sau khi tạo tài khoản.')}</small></span></label></fieldset>}
          <label>{t('Email', 'Email')}<input required autoComplete="email" type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>{t('Password', 'Mật khẩu')}<input required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button disabled={isSubmitting} type="submit">{isSubmitting ? t('Please wait…', 'Vui lòng chờ…') : mode === 'login' ? t('Sign in', 'Đăng nhập') : t('Create account', 'Tạo tài khoản')}</button>
        </form>
      </section>
    </section>
  </main>;
}
