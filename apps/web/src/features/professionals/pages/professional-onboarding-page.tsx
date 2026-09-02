import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import type { AuthenticationResponse, ProfessionalProfile } from '@salon-spot/contracts';
import { ApiRequestError } from '../../../shared/api/http';
import { refreshSession } from '../../auth/api/auth-api';
import { getProfessionalProfile, updateProfessionalProfile } from '../api/professional-profile-api';

interface ProfessionalOnboardingPageProps {
  initialSession: AuthenticationResponse | null;
  onSessionRestored: (session: AuthenticationResponse) => void;
  onSessionEnded: () => void;
}

export function ProfessionalOnboardingPage({ initialSession, onSessionRestored, onSessionEnded }: ProfessionalOnboardingPageProps): JSX.Element {
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
      if (reason instanceof ApiRequestError && reason.status === 401) onSessionEnded(); else setError(messageFor(reason));
    } finally { setIsLoading(false); }
  }

  async function refreshSessionOnce(): Promise<AuthenticationResponse> {
    if (!refreshInFlight.current) refreshInFlight.current = refreshSession().finally(() => { refreshInFlight.current = null; });
    return refreshInFlight.current;
  }

  async function loadProfile(accessToken: string): Promise<void> {
    setIsLoading(true);
    try { applyProfile(await getProfessionalProfile(accessToken)); }
    catch (reason) { setError(messageFor(reason)); }
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
    } catch (reason) { setError(messageFor(reason)); }
    finally { setIsSaving(false); }
  }

  return <main className="page-shell professional-shell">
    <header className="page-heading"><div><p className="eyebrow">PROFESSIONAL ONBOARDING</p><h1>Tell salons about your work</h1><p className="lead">Complete the details below. Your account remains pending until the Professional access review is completed.</p></div>{profile && <span className={`status-badge professional-status-${profile.status.toLowerCase()}`}>{profile.status}</span>}</header>
    {error && <p className="notice error" role="alert">{error}</p>}
    {isLoading ? <p className="notice" role="status">Loading your Professional profile…</p> : !auth ? <section className="auth-card"><h2>Sign in to continue</h2><p className="lead">Your Professional onboarding is available after you sign in.</p></section> : profile && <section className="auth-card"><div><p className="eyebrow">YOUR PROFILE</p><h2>Professional details</h2></div><form className="owner-form" onSubmit={submit}><label>Phone number<input autoComplete="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>City or area<input autoComplete="address-level2" maxLength={120} value={city} onChange={(event) => setCity(event.target.value)} /></label><label>Specialties <small>Separate with commas</small><input maxLength={720} value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Hair styling, nails, makeup" /></label><label>About your work<textarea rows={5} maxLength={1000} value={bio} onChange={(event) => setBio(event.target.value)} /></label><button disabled={isSaving} type="submit">{isSaving ? 'Saving…' : 'Save Professional profile'}</button></form></section>}
  </main>;
}

function messageFor(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong. Please try again.';
}
