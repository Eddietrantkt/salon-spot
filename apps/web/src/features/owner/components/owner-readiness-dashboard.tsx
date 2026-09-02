import type { JSX } from 'react';
import type { OwnerSalon } from '@salon-spot/contracts';

interface OwnerReadinessDashboardProps {
  salons: OwnerSalon[];
}

export function OwnerReadinessDashboard({ salons }: OwnerReadinessDashboardProps): JSX.Element {
  const workspaces = salons.flatMap((salon) => salon.workspaces);
  const published = workspaces.filter((workspace) => workspace.status === 'PUBLISHED').length;
  const drafts = workspaces.filter((workspace) => workspace.status === 'DRAFT').length;
  const readyMedia = workspaces.flatMap((workspace) => workspace.media).filter((media) => media.status === 'READY').length;
  const nextStep = drafts > 0
    ? `${drafts} workspace${drafts === 1 ? ' is' : 's are'} still in draft. Complete the publishing checklist before opening availability.`
    : published > 0
      ? 'Choose a date for each workspace to review, open, or block fixed time slots.'
      : 'Create your first workspace to start setting up your supply.';

  return <section className="owner-readiness" aria-label="Owner operations overview">
    <div><p className="eyebrow">OPERATIONS OVERVIEW</p><h2>Your salon at a glance</h2><p>{nextStep}</p></div>
    <dl className="readiness-metrics">
      <Metric label="Salon" value={salons.length} />
      <Metric label="Published workspaces" value={`${published}/${workspaces.length}`} emphasis={published > 0} />
      <Metric label="Draft workspaces" value={drafts} emphasis={drafts > 0} />
      <Metric label="Ready workspace photos" value={readyMedia} />
    </dl>
  </section>;
}

function Metric({ label, value, emphasis = false }: { label: string; value: string | number; emphasis?: boolean }): JSX.Element {
  return <div className={emphasis ? 'readiness-metric readiness-metric-emphasis' : 'readiness-metric'}><dt>{label}</dt><dd>{value}</dd></div>;
}
