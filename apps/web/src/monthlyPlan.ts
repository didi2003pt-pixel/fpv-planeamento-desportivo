import type { DemoActivity } from './demo';
import { isValidCivilDate } from './activityDraft';

export interface PlanningDates { start: string; end: string }

export function annualPlanDates(activity: DemoActivity): PlanningDates {
  return {
    start: activity.annualStart ?? activity.start,
    end: activity.annualEnd ?? activity.end,
  };
}

export function monthlyDatesDiffer(activity: DemoActivity): boolean {
  const annual = annualPlanDates(activity);
  return annual.start !== activity.start || annual.end !== activity.end;
}

/**
 * Uma confirmação mensal não apaga a previsão anual. Atualiza apenas as
 * datas operacionais que alimentam o calendário e o Excel existente.
 * Esta função é apenas para a demonstração estática do GitHub Pages.
 */
export function confirmMonthlyPlan(
  activity: DemoActivity, start: string, end: string,
): DemoActivity {
  if (activity.status === 'CANCELLED' || activity.status === 'COMPLETED') {
    throw new Error('Não é possível confirmar mensalmente atividades canceladas ou realizadas.');
  }
  if (!isValidCivilDate(start) || !isValidCivilDate(end)) {
    throw new Error('Indica datas válidas para a confirmação mensal.');
  }
  if (start > end) throw new Error('O fim do planeamento mensal não pode ser anterior ao início.');
  const annual = annualPlanDates(activity);
  return {
    ...activity,
    annualStart: annual.start,
    annualEnd: annual.end,
    start, end,
    monthlyConfirmed: true,
    status: 'CONFIRMED',
  };
}
