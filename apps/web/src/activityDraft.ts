import type { ActivityStatus, ActivityType, DemoActivity } from './demo';
import { fpvReferenceClasses } from './exportClassMap';

export interface ActivityDraft {
  title: string;
  sailingClass: string;
  type: ActivityType;
  status: ActivityStatus;
  start: string;
  end: string;
  location: string;
  expectedAthletes: number;
  participantLines: string;
}

/** Retorna um rascunho fiel ao evento, sem modificar o original. */
export function activityToDraft(activity: DemoActivity): ActivityDraft {
  return {
    title: activity.title,
    sailingClass: activity.sailingClass,
    type: activity.type,
    status: activity.status,
    start: activity.start,
    end: activity.end,
    location: activity.location === 'Por definir' ? '' : activity.location,
    expectedAthletes: activity.expectedAthletes,
    participantLines: activity.participants.join('\n'),
  };
}

/** Valores de exemplo, sem qualquer pessoa ou atividade real. */
export function initialActivityDraft(start: string): ActivityDraft {
  return {
    title: '', sailingClass: 'ILCA 7', type: 'CAMP',
    status: 'PLANNED', start, end: start, location: '',
    expectedAthletes: 3, participantLines: '',
  };
}

export function parseParticipants(lines: string): string[] {
  return lines.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
}

export function isValidCivilDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function validateActivityDraft(draft: ActivityDraft): string | null {
  const title = draft.title.trim();
  if (!title || title.length > 200) return 'Indica um título (até 200 caracteres).';
  if (!fpvReferenceClasses.some((item) => item === draft.sailingClass)) {
    return 'Seleciona uma classe da lista.';
  }
  if (!['CAMP', 'COMPETITION', 'TRAINING', 'TRAVEL', 'EDUCATION', 'OTHER'].includes(draft.type)) {
    return 'Seleciona um tipo de atividade válido.';
  }
  if (!['PLANNED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(draft.status)) {
    return 'Seleciona o estado previsto ou confirmado.';
  }
  if (!isValidCivilDate(draft.start) || !isValidCivilDate(draft.end)) {
    return 'Indica datas válidas no formato dia/mês/ano.';
  }
  if (draft.start > draft.end) return 'A data de fim não pode ser anterior à data de início.';
  if (draft.location.trim().length > 200) return 'O local não pode ultrapassar 200 caracteres.';
  if (!Number.isInteger(draft.expectedAthletes) || draft.expectedAthletes < 0
    || draft.expectedAthletes > 200) {
    return 'O número previsto de atletas deve ser um inteiro entre 0 e 200.';
  }
  const names = parseParticipants(draft.participantLines);
  if (names.length > draft.expectedAthletes) {
    return 'Há mais nomes indicados do que atletas previstos. Aumenta o número previsto ou retira nomes.';
  }
  if (names.some((name) => name.length > 160)) return 'Cada nome pode ter até 160 caracteres.';
  if (new Set(names.map((name) => name.normalize('NFKC').toLocaleLowerCase('pt-PT'))).size !== names.length) {
    return 'Há nomes repetidos na lista de participantes.';
  }
  return null;
}

export function createDemoActivity(draft: ActivityDraft, id: string): DemoActivity {
  const error = validateActivityDraft(draft);
  if (error) throw new Error(error);
  if (draft.status === 'CANCELLED' || draft.status === 'COMPLETED') {
    throw new Error('Uma nova atividade tem de começar como prevista ou confirmada.');
  }
  return {
    id,
    title: draft.title.trim(),
    sailingClass: draft.sailingClass,
    type: draft.type,
    status: draft.status,
    start: draft.start,
    end: draft.end,
    location: draft.location.trim() || 'Por definir',
    coach: 'Treinador de demonstração',
    expectedAthletes: draft.expectedAthletes,
    participants: parseParticipants(draft.participantLines),
  };
}

/** Edição local: conserva o ID e o treinador; apenas campos do formulário mudam. */
export function editDemoActivity(original: DemoActivity, draft: ActivityDraft): DemoActivity {
  const error = validateActivityDraft(draft);
  if (error) throw new Error(error);
  return {
    ...original,
    title: draft.title.trim(),
    sailingClass: draft.sailingClass,
    type: draft.type,
    status: draft.status,
    start: draft.start,
    end: draft.end,
    location: draft.location.trim() || 'Por definir',
    expectedAthletes: draft.expectedAthletes,
    participants: parseParticipants(draft.participantLines),
  };
}

/** Cancelamento é uma alteração de estado, não elimina o registo ou participantes. */
export function changeDemoActivityStatus(
  original: DemoActivity, status: 'CANCELLED' | 'PLANNED',
): DemoActivity {
  return { ...original, status };
}
