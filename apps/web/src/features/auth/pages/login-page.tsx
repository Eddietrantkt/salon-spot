import { useState, type FormEvent, type JSX } from 'react';
import type { RegistrationIntent } from '@salon-spot/contracts';
import type { AuthenticationResponse } from '@salon-spot/contracts';
import { ApiRequestError } from '../../../shared/api/http';
import { buildAuthenticationRequest, type AuthenticationMode } from '../auth-request';
import { login, register } from '../api/auth-api';

export type LoginDestination = 'booking' | 'my-bookings' | 'owner' | 'admin' | 'explore';

interface LoginPageProps {
  destination: LoginDestination;
  onAuthenticated: (session: AuthenticationResponse, registrationIntent?: RegistrationIntent) => void;
  onBack: () => void;
}

const destinationCopy: Record<LoginDestination, { eyebrow: string; title: string; description: string }> = {
  booking: { eyebrow: 'RESERVE A WORKSPACE', title: 'Sign in to reserve a time', description: 'Use one account to hold and manage your workspace bookings.' },
  'my-bookings': { eyebrow: 'MY BOOKINGS', title: 'Sign in to view your bookings', description: 'Review upcoming sessions, booking status and permitted cancellations.' },
  owner: { eyebrow: 'OWNER CONSOLE', title: 'Sign in to manage your salon', description: 'Create and publish workspaces, then manage their availability.' },
  admin: { eyebrow: 'OPERATIONS', title: 'Admin sign in', description: 'Admin access is granted by the operations team after your account has been created.' },
  explore: { eyebrow: 'YOUR ACCOUNT', title: 'Welcome back', description: 'Sign in once to manage bookings or your salon workspace.' }
};

export function LoginPage({ destination, onAuthenticated, onBack }: LoginPageProps): JSX.Element {
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
      setError(reason instanceof ApiRequestError || reason instanceof Error ? reason.message : 'We could not sign you in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="page-shell auth-shell">
    <button className="text-button" type="button" onClick={onBack}>← Back to explore</button>
    <section className="auth-layout" aria-labelledby="login-heading">
      <div className="auth-introduction">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="login-heading">{mode === 'login' ? copy.title : 'Create your account'}</h1>
        <p className="lead">{mode === 'login' ? copy.description : 'Choose the journey you want to start. You can later add another capability to the same account.'}</p>
        <ul className="auth-benefits">
          <li>Your password is protected by the server; it is never stored in the browser.</li>
          <li>Your session can be safely restored using a secure refresh cookie.</li>
          <li>Creating a salon grants Owner access for that salon. Professional access stays pending until activated.</li>
        </ul>
      </div>
      <section className="auth-card" aria-label={mode === 'login' ? 'Sign in form' : 'Registration form'}>
        <div className="section-heading">
          <div><p className="eyebrow">{mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}</p><h2>{mode === 'login' ? 'Continue with your account' : 'Start with one account'}</h2></div>
          <button className="text-button" type="button" onClick={() => { setMode((current) => current === 'login' ? 'register' : 'login'); setError(null); }}>
            {mode === 'login' ? 'Create account' : 'Sign in instead'}
          </button>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <form className="owner-form" onSubmit={submit}>
          {mode === 'register' && <label>Full name<input required autoComplete="name" maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>}
          {mode === 'register' && <fieldset className="role-picker"><legend>How would you like to start?</legend><label className={onboardingIntent === 'PROFESSIONAL' ? 'role-choice role-choice-selected' : 'role-choice'}><input type="radio" name="onboardingIntent" value="PROFESSIONAL" checked={onboardingIntent === 'PROFESSIONAL'} onChange={() => setOnboardingIntent('PROFESSIONAL')} /><span><strong>Beauty Professional</strong><small>Build your profile first. Booking access is activated after review.</small></span></label><label className={onboardingIntent === 'OWNER' ? 'role-choice role-choice-selected' : 'role-choice'}><input type="radio" name="onboardingIntent" value="OWNER" checked={onboardingIntent === 'OWNER'} onChange={() => setOnboardingIntent('OWNER')} /><span><strong>Salon Owner</strong><small>Set up your first salon and workspace after account creation.</small></span></label></fieldset>}
          <label>Email<input required autoComplete="email" type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button disabled={isSubmitting} type="submit">{isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
      </section>
    </section>
  </main>;
}
