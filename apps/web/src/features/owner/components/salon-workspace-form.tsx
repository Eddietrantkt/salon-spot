import { useState, type FormEvent, type JSX } from 'react';
import type { CreateSalonWithWorkspaceInput } from '@salon-spot/contracts';
import { useI18n } from '../../../shared/i18n/i18n-provider';

const salonTimezoneOptions = [
  { value: 'Asia/Ho_Chi_Minh', label: ['Vietnam — GMT+7', 'Việt Nam — GMT+7'] },
  { value: 'Asia/Bangkok', label: ['Thailand — GMT+7', 'Thái Lan — GMT+7'] },
  { value: 'Asia/Singapore', label: ['Singapore — GMT+8', 'Singapore — GMT+8'] }
] as const;

interface SalonWorkspaceFormProps {
  isLoading: boolean;
  onSubmit: (input: CreateSalonWithWorkspaceInput) => Promise<void>;
}

export function SalonWorkspaceForm({ isLoading, onSubmit }: SalonWorkspaceFormProps): JSX.Element {
  const { t } = useI18n();
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
      <p className="eyebrow">{t('GET STARTED', 'BẮT ĐẦU')}</p>
      <h2 id="salon-setup-heading">{t('Create your first salon and workspace', 'Tạo salon và không gian đầu tiên')}</h2>
      <p className="lead">{t('Your workspace stays in draft until you complete its media and availability setup.', 'Không gian sẽ ở trạng thái nháp cho đến khi bạn hoàn tất hình ảnh và lịch trống.')}</p>
      <form className="owner-form setup-form" onSubmit={submit}>
        <label>{t('Salon name', 'Tên salon')}<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>{t('Location', 'Địa điểm')}<input required maxLength={120} value={area} onChange={(event) => setArea(event.target.value)} /></label>
        <label>{t('Salon timezone', 'Múi giờ salon')}
          <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {salonTimezoneOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label[0], option.label[1])}</option>)}
          </select>
          <small>{t('Used to show accurate local dates and time slots for your salon.', 'Dùng để hiển thị chính xác ngày và khung giờ địa phương của salon.')}</small>
        </label>
        <label>{t('Workspace name', 'Tên không gian')}<input required maxLength={160} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label>
        <label>{t('Rental label', 'Tên gói thuê')}<input required maxLength={120} value={rentalLabel} onChange={(event) => setRentalLabel(event.target.value)} /></label>
        <label>{t('Rate (VND)', 'Giá thuê (VND)')}<input required type="number" min="1" max="100000000" step="1" value={priceVnd} onChange={(event) => setPriceVnd(event.target.value)} /></label>
        <button disabled={isLoading} type="submit">{isLoading ? t('Creating…', 'Đang tạo…') : t('Create salon & workspace', 'Tạo salon và không gian')}</button>
      </form>
    </section>
  );
}
