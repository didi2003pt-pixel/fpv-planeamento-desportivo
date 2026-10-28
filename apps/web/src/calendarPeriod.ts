import type { DemoActivity } from './demo';

/**
 * Janela civil: início incluído, fim excluído, ambos YYYY-MM-DD.
 * As atividades têm datas de início e fim inclusivas.
 */
export interface CalendarPeriod {
  start: string;
  endExclusive: string;
}

export function activitiesInPeriod(
  activities: DemoActivity[], period: CalendarPeriod,
): DemoActivity[] {
  return activities.filter((activity) =>
    activity.start < period.endExclusive && activity.end >= period.start);
}

export function periodFromMonth(date: Date): CalendarPeriod {
  return {
    start: civilDate(new Date(date.getFullYear(), date.getMonth(), 1)),
    endExclusive: civilDate(new Date(date.getFullYear(), date.getMonth() + 1, 1)),
  };
}

export function civilDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return [year, month, day].join('-');
}
