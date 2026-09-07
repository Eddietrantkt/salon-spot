import type { JSX } from 'react';
import type { OwnerSalon } from '@salon-spot/contracts';
import { useI18n } from '../../../shared/i18n/i18n-provider';

interface OwnerReadinessDashboardProps {
  salons: OwnerSalon[];
}

export function OwnerReadinessDashboard({ salons }: OwnerReadinessDashboardProps): JSX.Element {
  const { t } = useI18n();
  const workspaces = salons.flatMap((salon) => salon.workspaces);
  const published = workspaces.filter((workspace) => workspace.status === 'PUBLISHED').length;
  const drafts = workspaces.filter((workspace) => workspace.status === 'DRAFT').length;
  const readyMedia = workspaces.flatMap((workspace) => workspace.media).filter((media) => media.status === 'READY').length;
  const nextStep = drafts > 0
    ? localeNextStep(t, drafts)
    : published > 0
      ? t('Choose a date for each workspace to review, open, or block fixed time slots.', 'Chọn ngày cho từng không gian để xem, mở hoặc chặn các khung giờ cố định.')
      : t('Create your first workspace to start setting up your supply.', 'Tạo không gian đầu tiên để bắt đầu thiết lập nguồn cung của bạn.');

  return <section className="owner-readiness" aria-label={t('Owner operations overview', 'Tổng quan vận hành của chủ salon')}>
    <div><p className="eyebrow">{t('OPERATIONS OVERVIEW', 'TỔNG QUAN VẬN HÀNH')}</p><h2>{t('Your salon at a glance', 'Tổng quan salon của bạn')}</h2><p>{nextStep}</p></div>
    <dl className="readiness-metrics">
      <Metric label={t('Salon', 'Salon')} value={salons.length} />
      <Metric label={t('Published workspaces', 'Không gian đã công bố')} value={`${published}/${workspaces.length}`} emphasis={published > 0} />
      <Metric label={t('Draft workspaces', 'Không gian nháp')} value={drafts} emphasis={drafts > 0} />
      <Metric label={t('Ready workspace photos', 'Ảnh không gian đã sẵn sàng')} value={readyMedia} />
    </dl>
  </section>;
}

function localeNextStep(t: (english: string, vietnamese: string) => string, drafts: number): string {
  return t(
    `${drafts} workspace${drafts === 1 ? ' is' : 's are'} still in draft. Complete the publishing checklist before opening availability.`,
    `${drafts} không gian vẫn ở trạng thái nháp. Hãy hoàn tất danh sách kiểm tra công bố trước khi mở lịch trống.`
  );
}

function Metric({ label, value, emphasis = false }: { label: string; value: string | number; emphasis?: boolean }): JSX.Element {
  return <div className={emphasis ? 'readiness-metric readiness-metric-emphasis' : 'readiness-metric'}><dt>{label}</dt><dd>{value}</dd></div>;
}
