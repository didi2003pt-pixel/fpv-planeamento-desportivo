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
