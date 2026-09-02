import { useState, type FormEvent, type JSX } from 'react';
import type { CreateSalonWithWorkspaceInput } from '@salon-spot/contracts';

const salonTimezoneOptions = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Vietnam — GMT+7' },
  { value: 'Asia/Bangkok', label: 'Thailand — GMT+7' },
  { value: 'Asia/Singapore', label: 'Singapore — GMT+8' }
] as const;

interface SalonWorkspaceFormProps {
  isLoading: boolean;
  onSubmit: (input: CreateSalonWithWorkspaceInput) => Promise<void>;
}

export function SalonWorkspaceForm({ isLoading, onSubmit }: SalonWorkspaceFormProps): JSX.Element {
  const [name, setName] = useState('Luna Beauty House');
  const [area, setArea] = useState('D1');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [workspaceName, setWorkspaceName] = useState('Styling Chair 01');
  const [rentalLabel, setRentalLabel] = useState('2 hours');
  const [priceVnd, setPriceVnd] = useState('250000');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await onSubmit({
      name, area, timezone,
      workspace: { name: workspaceName, rentalLabel, priceCents: Number(priceVnd) }
    });
  }

  return (
    <section className="owner-panel" aria-labelledby="salon-setup-heading">
      <p className="eyebrow">GET STARTED</p>
      <h2 id="salon-setup-heading">Create your first salon and workspace</h2>
      <p className="lead">Your workspace stays in draft until you complete its media and availability setup.</p>
      <form className="owner-form setup-form" onSubmit={submit}>
        <label>Salon name<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Location<input required maxLength={120} value={area} onChange={(event) => setArea(event.target.value)} /></label>
        <label>Salon timezone
          <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {salonTimezoneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <small>Used to show accurate local dates and time slots for your salon.</small>
        </label>
        <label>Workspace name<input required maxLength={160} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label>
        <label>Rental label<input required maxLength={120} value={rentalLabel} onChange={(event) => setRentalLabel(event.target.value)} /></label>
        <label>Rate (VND)<input required type="number" min="1" max="100000000" step="1" value={priceVnd} onChange={(event) => setPriceVnd(event.target.value)} /></label>
        <button disabled={isLoading} type="submit">{isLoading ? 'Creating…' : 'Create salon & workspace'}</button>
      </form>
    </section>
  );
}
