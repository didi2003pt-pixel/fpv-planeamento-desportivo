import type { DemoActivity } from './demo';
import { fpvReferenceClasses } from './exportClassMap';

/**
 * Catálogo inteiramente fictício para avaliar a experiência de uso.
 * Não é autenticação nem autorização: toda a aplicação é pública/estática.
 */
export interface DemoCoach {
  id: string;
  name: string;
  sailingClasses: string[];
}

export const FEDERATION_VIEW = 'federation';

export function initialDemoCoaches(): DemoCoach[] {
  return [
    { id: 'coach-1', name: 'Treinador A (exemplo)', sailingClasses: ['ILCA 7', 'ILCA 6', 'ILCA 4'] },
    { id: 'coach-2', name: 'Treinador B (exemplo)', sailingClasses: ['470 MX', '49er', '49er FX', '29er'] },
    { id: 'coach-3', name: 'Treinador C (exemplo)', sailingClasses: ['Formula Kite M', 'Formula Kite F', 'IQFOIL', 'TECHNO 293'] },
    { id: 'coach-4', name: 'Treinador D (exemplo)', sailingClasses: ['420', 'Optimist', 'Hansa', 'RS Venture', 'Formação Atletas', 'Formação Treinadores'] },
  ];
}

export function classesForDemoView(viewId: string, coaches: DemoCoach[]): string[] | null {
  if (viewId === FEDERATION_VIEW) return null; // Todas as classes.
  return coaches.find((coach) => coach.id === viewId)?.sailingClasses ?? [];
}

export function activitiesForDemoView(
  activities: DemoActivity[], viewId: string, coaches: DemoCoach[],
): DemoActivity[] {
  const allowed = classesForDemoView(viewId, coaches);
  return allowed === null ? activities : activities.filter((activity) =>
    allowed.includes(activity.sailingClass));
}

export function assignDemoCoachClasses(
  coaches: DemoCoach[], id: string, sailingClasses: string[],
): DemoCoach[] {
  if (!coaches.some((coach) => coach.id === id)) throw new Error('Treinador não encontrado.');
  if (new Set(sailingClasses).size !== sailingClasses.length
    || sailingClasses.some((item) => !fpvReferenceClasses.includes(item as typeof fpvReferenceClasses[number]))) {
    throw new Error('A lista de classes contém valores inválidos ou repetidos.');
  }
  return coaches.map((coach) => coach.id === id
    ? { ...coach, sailingClasses: [...sailingClasses] } : coach);
}

/** Acrescenta um exemplo — nunca pedir nomes reais na demonstração pública. */
export function appendFictitiousCoach(coaches: DemoCoach[]): DemoCoach[] {
  const id = 'coach-' + (Math.max(0, ...coaches.map((coach) => Number(coach.id.split('-')[1]) || 0)) + 1);
  return [...coaches, {
    id, name: 'Treinador de exemplo ' + id.split('-')[1], sailingClasses: [],
  }];
}

export function demoCoachNameForClass(coaches: DemoCoach[], sailingClass: string): string {
  return coaches.find((coach) => coach.sailingClasses.includes(sailingClass))?.name
    ?? 'Treinador de demonstração';
}
