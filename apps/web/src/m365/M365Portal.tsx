import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BrowserCacheLocation, PublicClientApplication, type AccountInfo,
} from '@azure/msal-browser';
import { loadM365Config, type M365Class, type M365Config } from './config';
import { confirmClassMonth, createClassActivity, GraphError, listClassActivities } from './graph';
import { TYPES, validateDraft, type M365Activity, type M365Draft } from './model';
import './m365.css';

const scopes = ['User.Read', 'Lists.SelectedOperations.Selected'];
const today = new Date();
const defaultMonth = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
const initialDraft = (): M365Draft => ({
  title: '', type: 'CAMP', start: defaultMonth + '-01', end: defaultMonth + '-01',
  location: '', expectedAthletes: 0,
});
function errorText(error: unknown): string {
  if (error instanceof GraphError) return error.message;
  // Nunca mostrar respostas brutas do Graph nem eventuais tokens na interface.
  return error instanceof Error && /Data inválida|Período mensal|Título obrigatório|Tipo de atividade|Número de atletas|Local demasiado|sem versão ETag|cancelada ou realizada/i.test(error.message)
    ? error.message
    : 'Não foi possível concluir a operação. Confirma a configuração Microsoft e as permissões no SharePoint.';
}

export default function M365Portal() {
  const msal = useRef<PublicClientApplication | null>(null);
  const [config, setConfig] = useState<M365Config | null>(null);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [activities, setActivities] = useState<M365Activity[]>([]);
  const [accessible, setAccessible] = useState<M365Class[]>([]);
  const [denied, setDenied] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [month, setMonth] = useState(defaultMonth);
  const [classId, setClassId] = useState('');
  const [draft, setDraft] = useState<M365Draft>(initialDraft);
  const [review, setReview] = useState<M365Activity | null>(null);
  const [monthlyStart, setMonthlyStart] = useState('');
  const [monthlyEnd, setMonthlyEnd] = useState('');

  useEffect(() => {
    let alive = true;
    loadM365Config().then(async value => {
      if (!alive) return;
      if (!value) { setReady(true); return; }
      const auth = new PublicClientApplication({
        auth: {
          clientId: value.clientId,
          authority: 'https://login.microsoftonline.com/' + value.tenantId,
          redirectUri: window.location.origin + import.meta.env.BASE_URL + 'redirect.html',
          postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
        },
        cache: { cacheLocation: BrowserCacheLocation.MemoryStorage },
      });
      await auth.initialize();
      if (alive) { msal.current = auth; setConfig(value); setReady(true); }
    }).catch(() => { if (alive) { setError('Não foi possível carregar a configuração Microsoft.'); setReady(true); } });
    return () => { alive = false; };
  }, []);

  async function getToken(user: AccountInfo): Promise<string> {
    const app = msal.current;
    if (!app) throw new Error('A aplicação Microsoft não está configurada.');
    const response = await app.acquireTokenSilent({ scopes, account: user });
    return response.accessToken;
  }

  async function reload(user: AccountInfo) {
    if (!config) return;
    const accessToken = await getToken(user);
    const data: M365Activity[] = [];
    const permitted: M365Class[] = [];
    const noAccess: string[] = [];
    for (const item of config.classes) {
      try {
        const rows = await listClassActivities(config, item, accessToken);
        permitted.push(item);
        data.push(...rows);
      } catch (reason) {
        if (reason instanceof GraphError && reason.status === 403) {
          noAccess.push(item.code);
          continue;
        }
        throw reason;
      }
    }
    data.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
    setActivities(data);
    setAccessible(permitted);
    setDenied(noAccess);
    setClassId(current => permitted.some(item => item.listId === current)
      ? current : (permitted[0]?.listId ?? ''));
  }

  async function login() {
    if (!msal.current) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await msal.current.loginPopup({ scopes, prompt: 'select_account' });
      if (!result.account) throw new Error('Conta em falta.');
      setAccount(result.account);
      await reload(result.account);
      setNotice('Sessão Microsoft iniciada. As permissões são aplicadas pelo SharePoint.');
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError(''); setNotice('');
    try {
      if (msal.current && account) await msal.current.logoutPopup({ account });
      setAccount(null); setActivities([]); setAccessible([]); setDenied([]);
      setReview(null);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function refresh() {
    if (!account) return;
    setBusy(true); setError(''); setNotice('');
    try { await reload(account); setNotice('Atividades atualizadas a partir do SharePoint.'); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || !account) return;
    const list = accessible.find(item => item.listId === classId);
    if (!list) { setError('Seleciona uma classe a que tens acesso.'); return; }
    const validation = validateDraft(draft);
    if (validation) { setError(validation); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const token = await getToken(account);
      await createClassActivity(config, list, token, draft);
      setDraft(initialDraft());
      await reload(account);
      setNotice('Atividade guardada no SharePoint da classe ' + list.code + '.');
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function confirmMonthly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || !account || !review) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const token = await getToken(account);
      await confirmClassMonth(config, review, token, monthlyStart, monthlyEnd);
      setReview(null);
      await reload(account);
      setNotice('Plano mensal confirmado. A previsão anual foi preservada na lista SharePoint.');
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  const filtered = activities.filter(item =>
    item.start.slice(0, 7) <= month && item.end.slice(0, 7) >= month);

  return <main className="m365-root">
    <header className="m365-top">
      <div className="m365-brand"><span>FPV</span><div><strong>Planeamento Desportivo</strong><small>Integração Microsoft 365 · piloto</small></div></div>
      <a href={import.meta.env.BASE_URL}>Voltar ao calendário</a>
    </header>
    <div className="m365-container">
      <p className="m365-eyebrow">FEDERAÇÃO PORTUGUESA DE VELA · GITHUB PAGES + SHAREPOINT</p>
      <h1>Planeamento com Microsoft 365</h1>
      <p className="m365-muted">Login Microsoft e planeamentos guardados em listas SharePoint separadas por classe. O Excel aprovado e o calendário demonstrativo permanecem inalterados.</p>
      {!ready && <p role="status" className="m365-box">A verificar a configuração Microsoft…</p>}
      {ready && !config && <section className="m365-box m365-unconfigured">
        <h2>Continuar com Power Apps e SharePoint</h2>
        <p>Já é possível criar e alterar atividades na aplicação Power Apps ligada à lista SharePoint da FPV. Ao guardar, o Power Apps atualiza o mesmo item da lista; o histórico de versões do SharePoint regista as alterações.</p>
        <p><strong>Para ver o planeamento num calendário sem instalar nada:</strong></p>
        <ol>
          <li>Abre a lista da tua classe no SharePoint (por exemplo, a lista de testes ILCA 7).</li>
          <li>No seletor de vistas, junto a «Todos os itens», escolhe <strong>Adicionar vista → Calendário</strong>.</li>
          <li>Cria a vista <strong>Plano mensal</strong> com <code>StartDate</code> como início e <code>EndDate</code> como fim.</li>
          <li>Cria outra vista <strong>Plano anual</strong> com <code>AnnualStartDate</code> e <code>AnnualEndDate</code>.</li>
        </ol>
        <p>As duas vistas mostram os mesmos registos, sem duplicação. A autenticação e as permissões continuam a ser geridas pela Microsoft.</p>
        <div className="m365-shortcuts">
          <a href="https://make.powerapps.com/" target="_blank" rel="noopener noreferrer">Abrir Power Apps</a>
          <a href="https://www.microsoft365.com/launch/Lists" target="_blank" rel="noopener noreferrer">Abrir Microsoft Lists</a>
        </div>
        <p className="m365-muted">A ligação automática ao calendário React do GitHub ainda não funciona: faltam o registo Microsoft Entra, o consentimento e a configuração Graph. Não introduzas dados pessoais no calendário demonstrativo público.</p>
        <a href="https://github.com/didi2003pt-pixel/fpv-planeamento-desportivo/blob/main/docs/MICROSOFT_365.md" target="_blank" rel="noopener noreferrer">Guia de configuração e segurança</a>
      </section>}
      {error && <p className="m365-alert" role="alert">{error}</p>}
      {notice && <p className="m365-success" role="status">{notice}</p>}

      {config && !account && <section className="m365-box m365-login">
        <h2>Aceder com a conta Microsoft</h2>
        <p>Entra apenas com uma conta autorizada da organização. O site não guarda passwords Microsoft.</p>
        <button disabled={busy} onClick={login}>{busy ? 'A autenticar…' : 'Entrar com Microsoft 365'}</button>
        <small>A autenticação poderá solicitar aprovação do administrador Microsoft para a aplicação FPV.</small>
      </section>}
      {config && account && <>
        <section className="m365-user m365-box">
          <div><strong>{account.name ?? account.username}</strong><small>Identidade verificada pela Microsoft. O acesso aos dados é controlado pelas listas SharePoint.</small></div>
          <div><button disabled={busy} onClick={refresh}>Atualizar</button><button className="m365-light" disabled={busy} onClick={logout}>Terminar sessão</button></div>
        </section>
        <div className="m365-stats">
          <div><strong>{accessible.length}</strong><span>Classes acessíveis</span></div>
          <div><strong>{filtered.length}</strong><span>Atividades no mês</span></div>
          <div><strong>{filtered.filter(a => a.type === 'CAMP').length}</strong><span>Estágios no mês</span></div>
          <div><strong>{filtered.filter(a => a.type === 'COMPETITION').length}</strong><span>Competições no mês</span></div>
        </div>
        {denied.length > 0 && <p className="m365-info">
          {denied.length} lista(s) não acessível(eis) com esta conta. Para atribuir classes, o administrador deve configurar as permissões no SharePoint.
        </p>}
        <div className="m365-layout">
          <section className="m365-box">
            <div className="m365-heading"><h2>Atividades guardadas</h2>
              <label>Mês <input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
            </div>
            {filtered.length === 0
              ? <p className="m365-empty">Sem atividades neste mês e nas classes acessíveis à tua conta.</p>
              : <div className="m365-activities">{filtered.map(activity =>
                <div key={activity.listId + ':' + activity.id} className="m365-activity">
                  <div className="m365-activity-head"><strong>{activity.title}</strong><span>{activity.sailingClass}</span></div>
                  <p>{activity.start} — {activity.end} · {activity.location || 'Local por definir'}</p>
                  <small>{TYPES.find(t => t.value === activity.type)?.label} · {activity.status} · {activity.expectedAthletes} atletas previstos</small>
                  <div className="m365-row"><span>{activity.monthlyConfirmed ? 'Plano mensal confirmado' : 'Plano mensal por confirmar'}</span>
                    <button className="m365-plain" disabled={busy || activity.status === 'CANCELLED' || activity.status === 'COMPLETED'}
                      onClick={() => { setReview(activity); setMonthlyStart(activity.start); setMonthlyEnd(activity.end); setError(''); }}>
                      Confirmar / rever
                    </button>
                  </div>
                </div>)}</div>}
          </section>
          <section className="m365-box">
            <h2>Nova atividade</h2>
            <p className="m365-muted">Registo direto na lista SharePoint da classe. Usa apenas dados fictícios neste piloto.</p>
            <form className="m365-form" onSubmit={create}>
              <label>Classe <select required value={classId} onChange={e => setClassId(e.target.value)}>
                {accessible.length === 0 && <option value="">Sem classes acessíveis</option>}
                {accessible.map(item => <option key={item.listId} value={item.listId}>{item.code}</option>)}
              </select></label>
              <label>Nome da atividade <input required maxLength={200} value={draft.title}
                onChange={e => setDraft(v => ({...v,title:e.target.value}))} /></label>
              <label>Tipo <select value={draft.type}
                onChange={e => setDraft(v => ({...v,type:e.target.value as M365Draft['type']}))}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></label>
              <div className="m365-dates"><label>Início<input required type="date" value={draft.start}
                onChange={e => setDraft(v => ({...v,start:e.target.value}))}/></label>
                <label>Fim<input required type="date" value={draft.end}
                  onChange={e => setDraft(v => ({...v,end:e.target.value}))}/></label></div>
              <label>Local <input maxLength={200} value={draft.location}
                onChange={e => setDraft(v => ({...v,location:e.target.value}))}/></label>
              <label>Atletas previstos (sem nomes) <input required type="number" min={0} max={200}
                value={draft.expectedAthletes}
                onChange={e => setDraft(v => ({...v,expectedAthletes:Number(e.target.value)}))}/></label>
              <button disabled={busy || accessible.length === 0} type="submit">Guardar no SharePoint</button>
            </form>
          </section>
        </div>
        {review && <section className="m365-box m365-review" aria-label="Confirmação mensal">
          <h2>Confirmar mês — {review.title}</h2>
          <p>Previsão anual: <strong>{review.annualStart} até {review.annualEnd}</strong></p>
          <form className="m365-form" onSubmit={confirmMonthly}>
            <div className="m365-dates">
              <label>Início mensal<input type="date" required value={monthlyStart} onChange={e => setMonthlyStart(e.target.value)}/></label>
              <label>Fim mensal<input type="date" required value={monthlyEnd} onChange={e => setMonthlyEnd(e.target.value)}/></label>
            </div>
            <div className="m365-row"><button type="button" className="m365-light" onClick={() => setReview(null)}>Cancelar</button>
              <button type="submit" disabled={busy}>Confirmar datas</button></div>
          </form>
        </section>}
        <p className="m365-info">Piloto: a lista permite criar atividades e confirmar datas. A gestão de contas e classes faz-se no SharePoint; a edição geral e os nomes dos atletas não estão ativados.</p>
      </>}
    </div>
  </main>;
}
