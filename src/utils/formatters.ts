import dayjs from 'dayjs';

/**
 * Định dạng số tiền sang định dạng tiền tệ Việt Nam (VNĐ)
 * Ví dụ: 1000000 -> "1.000.000 ₫"
 */
export function formatVND(amount?: number | null, suffix = '₫'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `0 ${suffix}`;
  }
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${suffix}`;
}

/**
 * Formatter cho Ant Design InputNumber tiền tệ
 */
export const vndInputFormatter = (value?: string | number): string => {
  if (!value) return '';
  return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Parser cho Ant Design InputNumber tiền tệ
 */
export const vndInputParser = (displayValue?: string): number => {
  if (!displayValue) return 0;
  const parsed = displayValue.replace(/\./g, '').replace(/\s+/g, '');
  return Number(parsed) || 0;
};

/**
 * Định dạng ngày sang DD/MM/YYYY
 */
export function formatDateVN(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = dayjs(dateStr);
  return d.isValid() ? d.format('DD/MM/YYYY') : '—';
}

