import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isYesterday);

/**
 * Форматирует дату в формат времени (14:30)
 */
export function formatTime(date: string | Date): string {
  return dayjs(date).format('HH:mm');
}

/**
 * Форматирует дату в короткий формат (сегодня, вчера, дата)
 */
export function formatDate(date: string | Date): string {
  const d = dayjs(date);
  const now = dayjs();

  if (d.isToday()) {
    return d.format('HH:mm');
  }

  if (d.isYesterday()) {
    return 'Вчера';
  }

  if (d.year() === now.year()) {
    return d.format('D MMM');
  }

  return d.format('D MMM YYYY');
}

/**
 * Форматирует дату в относительном формате (5 мин назад)
 */
export function formatRelativeTime(date: string | Date): string {
  return dayjs(date).fromNow();
}

/**
 * Проверяет, является ли дата сегодняшней
 */
export function isDateToday(date: string | Date): boolean {
  return dayjs(date).isToday();
}

/**
 * Проверяет, является ли дата в этой неделе
 */
export function isDateThisWeek(date: string | Date): boolean {
  const d = dayjs(date);
  return d.isAfter(dayjs().startOf('week')) && d.isBefore(dayjs().endOf('week'));
}
