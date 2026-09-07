export type Translate = (english: string, vietnamese: string) => string;

const CONNECTION_ERROR = 'We could not reach the service. Check your connection and try again.';
const REQUEST_ERROR = 'We could not complete that request. Please try again.';

export function localizedErrorMessage(reason: unknown, t: Translate): string {
  if (!(reason instanceof Error)) return t('Something went wrong. Please try again.', 'Đã xảy ra lỗi. Vui lòng thử lại.');
  if (reason.message === CONNECTION_ERROR) return t(CONNECTION_ERROR, 'Không thể kết nối đến dịch vụ. Hãy kiểm tra kết nối và thử lại.');
  if (reason.message === REQUEST_ERROR) return t(REQUEST_ERROR, 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.');
  return reason.message;
}
