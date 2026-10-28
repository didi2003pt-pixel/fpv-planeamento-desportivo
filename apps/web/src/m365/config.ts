export interface M365Class {
  code: string;
  listId: string;
}
export interface M365Config {
  tenantId: string;
  clientId: string;
  siteId: string;
  classes: M365Class[];
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_ID = /^(?:[0-9a-f-]{36}|[a-z0-9.-]+,[0-9a-f-]{36},[0-9a-f-]{36})$/i;
const CODE = /^[\p{L}\p{N}][\p{L}\p{N} .+_-]{0,38}$/u;

/** Uma configuração incompleta nunca inicia sessão nem faz chamadas Graph. */
export function parseM365Config(raw: unknown): M365Config | null {
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.tenantId !== 'string' || !GUID.test(value.tenantId) ||
      typeof value.clientId !== 'string' || !GUID.test(value.clientId) ||
      typeof value.siteId !== 'string' || !SITE_ID.test(value.siteId) ||
      !Array.isArray(value.classes) || value.classes.length === 0 ||
      value.classes.length > 40) return null;
  const classes: M365Class[] = [];
  for (const item of value.classes) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (typeof row.code !== 'string' || !CODE.test(row.code) ||
        typeof row.listId !== 'string' || !GUID.test(row.listId)) return null;
    classes.push({ code: row.code, listId: row.listId });
  }
  if (new Set(classes.map(c => c.code.toLowerCase())).size !== classes.length ||
      new Set(classes.map(c => c.listId.toLowerCase())).size !== classes.length) return null;
  return {
    tenantId: value.tenantId, clientId: value.clientId,
    siteId: value.siteId, classes,
  };
}

export async function loadM365Config(): Promise<M365Config | null> {
  const response = await fetch(import.meta.env.BASE_URL + 'm365-config.json', { cache: 'no-store' });
  if (!response.ok) return null;
  return parseM365Config(await response.json());
}
