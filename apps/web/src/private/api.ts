/** Tipos públicos dos endpoints privados — nunca guardamos cookies ou passwords em storage. */
export interface SailingClass { id: string; code: string; name: string; active?: boolean }
export interface Account {
  id: string; fullName: string; email: string; role: string; active: boolean;
  authzVersion: number; classes: SailingClass[];
}
export interface Profile {
  id: string; fullName: string; email: string; role: string;
  sailingClasses: SailingClass[];
}
export interface Activity {
  id: string; title: string; type: string; status: string;
  startDate: string; endDate: string; location: string | null;
  monthlyConfirmed: boolean; annualStartDate?: string | null;
  annualEndDate?: string | null; expectedAthleteCount: number | null;
  sailingClass: SailingClass; leadCoach: { id: string; fullName: string };
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function errorText(status: number): string {
  if (status === 401) return 'A sessão expirou. Inicia sessão novamente.';
  if (status === 403) return 'Não tens permissões para esta operação.';
  if (status === 404) return 'O recurso já não está disponível.';
  if (status === 409) return 'Os dados mudaram entretanto. Atualiza e volta a tentar.';
  if (status === 429) return 'Demasiadas tentativas. Volta a tentar mais tarde.';
  if (status >= 500) return 'O servidor não conseguiu concluir a operação.';
  return 'O pedido não foi aceite. Verifica os dados e tenta novamente.';
}

export async function api<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!response.ok) throw new ApiError(response.status, errorText(response.status));
  return response.json() as Promise<T>;
}

/** Registo de atividades de teste: o servidor atribui automaticamente o treinador autenticado. */
export const privateActivityTypes = [
  { value: 'CAMP', label: 'Estágio' },
  { value: 'COMPETITION', label: 'Competição' },
  { value: 'TRAINING', label: 'Treino' },
  { value: 'TRAVEL', label: 'Deslocação' },
  { value: 'EDUCATION', label: 'Formação' },
  { value: 'OTHER', label: 'Outro' },
] as const;

export interface NewPrivateActivity {
  title: string;
  sailingClassId: string;
  type: (typeof privateActivityTypes)[number]['value'];
  startDate: string;
  endDate: string;
  location: string;
  expectedAthleteCount: number;
}

function validCivilDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function newActivityPayload(draft: NewPrivateActivity) {
  const title = draft.title.trim();
  if (!title || title.length > 200) throw new Error('Indica o título da atividade (até 200 caracteres).');
  if (!draft.sailingClassId) throw new Error('Seleciona uma classe autorizada.');
  if (!privateActivityTypes.some(item => item.value === draft.type)) throw new Error('Tipo de atividade inválido.');
  if (!validCivilDate(draft.startDate) || !validCivilDate(draft.endDate) || draft.endDate < draft.startDate) {
    throw new Error('Confirma as datas de início e fim.');
  }
  const location = draft.location.trim();
  if (location.length > 200) throw new Error('O local não pode exceder 200 caracteres.');
  if (!Number.isInteger(draft.expectedAthleteCount) || draft.expectedAthleteCount < 0 || draft.expectedAthleteCount > 200) {
    throw new Error('O número previsto de atletas deve estar entre 0 e 200.');
  }
  return {
    title,
    sailingClassId: draft.sailingClassId,
    type: draft.type,
    startDate: draft.startDate,
    endDate: draft.endDate,
    location: location || null,
    expectedAthleteCount: draft.expectedAthleteCount,
    // Não enviar leadCoachId: o backend utiliza a conta do treinador autenticado.
  };
}
