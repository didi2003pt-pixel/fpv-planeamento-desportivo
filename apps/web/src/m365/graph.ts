import type { M365Class, M365Config } from './config';
import { validDate, validateDraft, type M365Activity, type M365Draft, type PlanningStatus, type PlanningType } from './model';

const API = 'https://graph.microsoft.com/v1.0';
export class GraphError extends Error {
  constructor(readonly status: number, msg: string) { super(msg); }
}
interface ListRow {
  id?: string; eTag?: string; '@odata.etag'?: string;
  fields?: Record<string, unknown>;
}
interface ListPage { value?: ListRow[]; '@odata.nextLink'?: string; }

function field(fields: Record<string, unknown>, key: string): string {
  return typeof fields[key] === 'string' ? fields[key] as string : '';
}
function iso(value: string): string {
  if (!validDate(value)) throw new Error('Data inválida na atividade.');
  return value + 'T00:00:00Z';
}
function toActivity(row: ListRow, list: M365Class): M365Activity {
  if (!row.id || !row.fields) throw new Error('Lista SharePoint sem campos esperados.');
  const f = row.fields;
  const start = field(f,'StartDate').slice(0,10);
  const end = field(f,'EndDate').slice(0,10);
  const annualStart = field(f,'AnnualStartDate').slice(0,10) || start;
  const annualEnd = field(f,'AnnualEndDate').slice(0,10) || end;
  const title = field(f,'Title');
  const type = field(f,'ActivityType') as PlanningType;
  const status = field(f,'ActivityStatus') as PlanningStatus;
  if (!title || !validDate(start) || !validDate(end) ||
      !validDate(annualStart) || !validDate(annualEnd) ||
      !['TRAINING','CAMP','COMPETITION','TRAVEL','EDUCATION','OTHER'].includes(type) ||
      !['PLANNED','CONFIRMED','CANCELLED','COMPLETED'].includes(status)) {
    throw new Error('Esquema SharePoint inesperado. Verifica as colunas e os tipos da lista.');
  }
  const count = f.ExpectedAthletes;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('ExpectedAthletes inválido no SharePoint.');
  }
  return {
    id: row.id, listId: list.listId, etag: row.eTag ?? row['@odata.etag'] ?? '',
    sailingClass: list.code, title, type, status, start, end, annualStart, annualEnd,
    monthlyConfirmed: f.MonthlyConfirmed === true,
    location: field(f,'Location'), expectedAthletes: count,
  };
}
export function graphMessage(status: number): string {
  if (status === 401) return 'A sessão Microsoft expirou. Entra novamente.';
  if (status === 403) return 'Sem acesso a esta lista. Confirma as permissões no SharePoint.';
  if (status === 404) return 'Lista ou atividade não encontrada no SharePoint.';
  if (status === 412 || status === 409) return 'O planeamento foi alterado entretanto. Atualiza antes de guardar.';
  if (status === 429) return 'Limite temporário da Microsoft. Tenta novamente mais tarde.';
  return status >= 500 ? 'Serviço Microsoft temporariamente indisponível.'
    : 'O SharePoint não aceitou a operação.';
}
export function listItemsUrl(siteId: string, listId: string): string {
  return API + '/sites/' + encodeURIComponent(siteId) +
    '/lists/' + encodeURIComponent(listId) + '/items';
}
function paginationAllowed(next: string, list: M365Class, config: M365Config): boolean {
  try {
    const url = new URL(next);
    return url.origin === 'https://graph.microsoft.com'
      && decodeURIComponent(url.pathname) ===
        '/v1.0/sites/' + config.siteId + '/lists/' + list.listId + '/items';
  } catch { return false; }
}
async function graphFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  if (!url.startsWith(API + '/')) throw new Error('Endereço Graph inesperado.');
  const headers: Record<string,string> = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/json',
  };
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  if (init?.headers) Object.assign(headers, init.headers);
  const response = await fetch(url, { ...init, headers, cache: 'no-store' });
  if (!response.ok) throw new GraphError(response.status, graphMessage(response.status));
  return (await response.json()) as T;
}

/** Uma lista diferente por classe; SharePoint é a fronteira de autorização. */
export async function listClassActivities(
  config: M365Config, list: M365Class, token: string,
): Promise<M365Activity[]> {
  const base = listItemsUrl(config.siteId, list.listId);
  let url: string | undefined = base + '?$expand=fields&$top=100';
  const activities: M365Activity[] = [];
  for (let page = 0; url && page < 20; page++) {
    if (!paginationAllowed(url, list, config)) throw new Error('Paginação Graph fora da lista permitida.');
    const data: ListPage = await graphFetch<ListPage>(url, token);
    if (!Array.isArray(data.value)) throw new Error('Resposta Graph inesperada.');
    activities.push(...data.value.map(row => toActivity(row, list)));
    const next: string | undefined = data['@odata.nextLink'];
    if (next && !paginationAllowed(next, list, config)) throw new Error('Paginação Graph fora da lista permitida.');
    url = next;
  }
  if (url) throw new Error('Lista demasiado extensa para a consulta inicial. Usar intervalo e paginação no próximo incremento.');
  return activities;
}
export async function createClassActivity(
  config: M365Config, list: M365Class, token: string, draft: M365Draft,
): Promise<void> {
  const issue = validateDraft(draft);
  if (issue) throw new Error(issue);
  await graphFetch<ListRow>(listItemsUrl(config.siteId, list.listId), token, {
    method: 'POST',
    body: JSON.stringify({ fields: {
      Title: draft.title.trim(),
      ActivityType: draft.type, ActivityStatus: 'PLANNED',
      StartDate: iso(draft.start), EndDate: iso(draft.end),
      AnnualStartDate: iso(draft.start), AnnualEndDate: iso(draft.end),
      MonthlyConfirmed: false, Location: draft.location.trim(),
      ExpectedAthletes: draft.expectedAthletes,
    } }),
  });
}
export async function confirmClassMonth(
  config: M365Config, activity: M365Activity, token: string, start: string, end: string,
): Promise<void> {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('Período mensal inválido.');
  if (activity.status === 'CANCELLED' || activity.status === 'COMPLETED') {
    throw new Error('Não é possível confirmar uma atividade cancelada ou realizada.');
  }
  if (!activity.etag) throw new Error('A atividade não tem versão ETag; não é seguro alterá-la.');
  if (!config.classes.some(c => c.listId === activity.listId)) throw new Error('Lista não configurada.');
  await graphFetch<Record<string,unknown>>(
    listItemsUrl(config.siteId, activity.listId) + '/' + encodeURIComponent(activity.id) + '/fields',
    token, { method: 'PATCH', headers: { 'If-Match': activity.etag },
      body: JSON.stringify({
        StartDate: iso(start), EndDate: iso(end), MonthlyConfirmed: true, ActivityStatus: 'CONFIRMED',
      }),
    },
  );
}
