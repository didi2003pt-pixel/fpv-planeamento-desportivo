import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  api, ApiError, newActivityPayload, privateActivityTypes,
  type Account, type Activity, type NewPrivateActivity, type Profile, type SailingClass,
} from './api';
import './private.css';

type Screen = 'accounts' | 'classes' | 'activities';
type Session = 'checking' | 'signed-out' | 'signed-in';
const roles = { ADMIN: 'Administrador', COORDINATOR: 'Coordenação',
  COACH: 'Treinador', VIEWER: 'Consulta' };

function monthRange() {
  const date = new Date();
  const year = date.getFullYear(), month = date.getMonth();
  const civil = (day: Date) => [
    day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'),
    String(day.getDate()).padStart(2, '0'),
  ].join('-');
  return { from: civil(new Date(year, month, 1)), to: civil(new Date(year, month + 1, 0)) };
}
function initialActivityDraft(): NewPrivateActivity {
  return { title: '', sailingClassId: '', type: 'CAMP', startDate: '', endDate: '',
    location: '', expectedAthleteCount: 0 };
}

function activityMonthRange(iso: string) {
  const year = Number(iso.slice(0, 4)), month = Number(iso.slice(5, 7));
  const last = String(new Date(year, month, 0).getDate()).padStart(2, '0');
  return { from: iso.slice(0, 7) + '-01', to: iso.slice(0, 7) + '-' + last };
}

function day(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = iso.slice(0, 10);
  const [year, month, d] = date.split('-');
  return year && month && d ? d + '/' + month + '/' + year : '—';
}
function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Não foi possível contactar a API privada. Verifica os containers Docker.';
}

export default function PrivatePortal() {
  const [session, setSession] = useState<Session>('checking');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Screen>('activities');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [classes, setClasses] = useState<SailingClass[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draftClasses, setDraftClasses] = useState<string[]>([]);
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'COACH' | 'COORDINATOR' | 'VIEWER'>('COACH');
  const [items, setItems] = useState<Activity[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [range, setRange] = useState(monthRange);
  const [newActivity, setNewActivity] = useState<NewPrivateActivity>(initialActivityDraft);

  const admin = profile?.role === 'ADMIN';
  const selected = useMemo(() => accounts.find(item => item.id === selectedId),
    [accounts, selectedId]);

  useEffect(() => {
    let active = true;
    api<{ user: Profile }>('/auth/me').then(result => {
      if (!active) return;
      setProfile(result.user); setSession('signed-in');
    }).catch(reason => {
      if (!active) return;
      setSession('signed-out');
      if (!(reason instanceof ApiError && reason.status === 401)) setError(message(reason));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    if (profile.role === 'ADMIN') {
      Promise.all([
        api<{ items: Account[] }>('/admin/users'),
        api<{ items: SailingClass[] }>('/admin/classes'),
      ]).then(([users, allClasses]) => {
        if (!active) return;
        setAccounts(users.items); setClasses(allClasses.items);
      }).catch(reason => { if (active) setError(message(reason)); });
    } else {
      api<{ items: SailingClass[] }>('/classes').then(result => {
        if (active) setClasses(result.items);
      }).catch(reason => { if (active) setError(message(reason)); });
    }
    return () => { active = false; };
  }, [profile]);

  useEffect(() => {
    setDraftClasses(selected?.classes.map(item => item.id) ?? []);
  }, [selected]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ user: Profile }>('/auth/login', 'POST', { email, password });
      setProfile(result.user);
      setSession('signed-in');
      setTab(result.user.role === 'ADMIN' ? 'accounts' : 'activities');
      setPassword(''); setEmail('');
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 401
        ? 'Email ou password incorretos, ou conta desativada.' : message(reason));
      setPassword('');
    } finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true); setError('');
    try {
      await api('/auth/logout', 'POST', {});
      setProfile(null); setSession('signed-out');
      setAccounts([]); setClasses([]); setItems([]); setSelectedId('');
      setNewActivity(initialActivityDraft());
    } catch (reason) {
      // Não mostrar a sessão como terminada quando a revogação falha no servidor.
      setError(message(reason));
    } finally { setBusy(false); }
  }

  async function refreshAdmin() {
    const [users, allClasses] = await Promise.all([
      api<{ items: Account[] }>('/admin/users'),
      api<{ items: SailingClass[] }>('/admin/classes'),
    ]);
    setAccounts(users.items); setClasses(allClasses.items);
  }

  async function action(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      await operation();
      if (admin) await refreshAdmin();
      setNotice(success);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409 && admin) {
        try { await refreshAdmin(); } catch { /* mantém erro inicial */ }
      }
      setError(message(reason));
    } finally { setBusy(false); }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action(async () => {
      await api('/admin/users', 'POST', {
        fullName: newName, email: newEmail,
        initialPassword: newPassword, role: newRole,
      });
      setNewName(''); setNewEmail(''); setNewPassword('');
    }, 'Conta de teste criada. O administrador pode agora atribuir classes.');
  }

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action(async () => {
      await api('/admin/classes', 'POST', { code: classCode, name: className });
      setClassCode(''); setClassName('');
    }, 'Classe adicionada à base de dados privada.');
  }

  async function saveAssignment() {
    if (!selected) return;
    await action(() => api('/admin/users/' + selected.id + '/classes', 'PUT', {
      classIds: draftClasses, expectedVersion: selected.authzVersion,
    }), 'Classes do treinador atualizadas no servidor.');
  }

  async function toggleAccount(account: Account) {
    const operation = account.active ? 'desativar' : 'reativar';
    if (!window.confirm('Queres ' + operation + ' a conta de ' + account.fullName + '?')) return;
    await action(() => api('/admin/users/' + account.id + '/status', 'PATCH', {
      active: !account.active, expectedVersion: account.authzVersion,
    }), account.active ? 'Conta desativada. Sessões existentes revogadas.' : 'Conta reativada.');
  }

  async function loadActivities(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const query = new URLSearchParams({ from: range.from, to: range.to });
      const result = await api<{ items: Activity[]; truncated: boolean }>('/activities?' + query);
      setItems(result.items); setTruncated(result.truncated);
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  async function createActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    if (profile?.role !== 'COACH') return;
    let payload: ReturnType<typeof newActivityPayload>;
    try {
      if (!classes.some(item => item.id === newActivity.sailingClassId)) {
        throw new Error('Seleciona uma classe atribuída à tua conta.');
      }
      payload = newActivityPayload(newActivity);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Confirma os dados da atividade.');
      return;
    }
    setBusy(true);
    try {
      await api('/activities', 'POST', payload);
      const nextRange = activityMonthRange(newActivity.startDate);
      setRange(nextRange);
      setNewActivity(current => ({ ...initialActivityDraft(), sailingClassId: current.sailingClassId }));
      setNotice('Atividade de teste guardada no servidor. A previsão anual foi preservada.');
      // A gravação já terminou; uma falha a atualizar a lista não deve levar a criar duplicados.
      try {
        const query = new URLSearchParams({ from: nextRange.from, to: nextRange.to });
        const result = await api<{ items: Activity[]; truncated: boolean }>('/activities?' + query);
        setItems(result.items); setTruncated(result.truncated);
      } catch {
        setError('Atividade guardada, mas não foi possível atualizar a lista. Carrega em Consultar.');
      }
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  }

  if (session === 'checking') return (
    <main className="private-shell private-centered"><p role="status">A verificar sessão privada…</p></main>
  );

  if (session === 'signed-out') return (
    <main className="private-shell private-centered">
      <section className="private-login">
        <div className="private-mark">FPV</div>
        <p className="private-eyebrow">FEDERAÇÃO PORTUGUESA DE VELA · AMBIENTE PRIVADO</p>
        <h1>Entrar no planeamento</h1>
        <p className="private-muted">Acesso a contas de teste e dados guardados no PostgreSQL local.</p>
        <div className="private-warning">
          Ambiente de desenvolvimento. Não utilizes contas oficiais ou dados pessoais reais.
          Esta área funciona apenas com a API privada em Docker, não no GitHub Pages.
        </div>
        <form onSubmit={signIn} className="private-form">
          <label>Email<input required type="email" autoComplete="username"
            value={email} onChange={e => setEmail(e.target.value)} placeholder="exemplo@fpv.invalid" /></label>
          <label>Password<input required type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} /></label>
          {error && <p className="private-error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? 'A autenticar…' : 'Entrar'}</button>
        </form>
        <a href="/">Voltar ao calendário demonstrativo</a>
      </section>
    </main>
  );

  return (
    <main className="private-shell">
      <header className="private-header">
        <div><span className="private-mark compact">FPV</span><span>Planeamento · Área privada</span></div>
        <div className="private-person">
          <span><strong>{profile?.fullName}</strong><small>{roles[profile!.role as keyof typeof roles] ?? profile?.role}</small></span>
          <button type="button" className="private-secondary" onClick={signOut} disabled={busy}>Terminar sessão</button>
        </div>
      </header>
      <div className="private-main">
        <nav className="private-sidebar" aria-label="Navegação privada">
          <button className={tab === 'activities' ? 'selected' : ''} onClick={() => setTab('activities')}>Atividades</button>
          {admin && <button className={tab === 'accounts' ? 'selected' : ''}
            onClick={() => setTab('accounts')}>Treinadores e contas</button>}
          {admin && <button className={tab === 'classes' ? 'selected' : ''}
            onClick={() => setTab('classes')}>Classes</button>}
          <a href="/">Calendário demonstrativo</a>
        </nav>
        <section className="private-content">
          <p className="private-eyebrow">BACKEND FPV · DADOS DE TESTE</p>
          {error && <p role="alert" className="private-error">{error}</p>}
          {notice && <p role="status" className="private-notice">{notice}</p>}

          {tab === 'activities' && <>
            <h1>Atividades guardadas</h1>
            <p className="private-muted">
              {admin ? 'Consulta global das atividades registadas.' :
                'Só são devolvidas pelo servidor as atividades das classes autorizadas para esta conta.'}
            </p>
            {profile?.role === 'COACH' && <section className="private-panel">
              <h2>Registar atividade do plano anual</h2>
              <p className="private-muted">Apenas para testes com dados fictícios. O servidor associa automaticamente a atividade à tua conta e verifica a classe.</p>
              <form className="private-grid-form" onSubmit={createActivity}>
                <label>Classe
                  <select required value={newActivity.sailingClassId}
                    onChange={e => setNewActivity(v => ({ ...v, sailingClassId: e.target.value }))}>
                    <option value="">Seleciona a classe</option>
                    {classes.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}
                  </select>
                </label>
                <label>Tipo de atividade
                  <select value={newActivity.type}
                    onChange={e => setNewActivity(v => ({ ...v, type: e.target.value as NewPrivateActivity['type'] }))}>
                    {privateActivityTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label>Nome da atividade
                  <input required maxLength={200} value={newActivity.title}
                    onChange={e => setNewActivity(v => ({ ...v, title: e.target.value }))} />
                </label>
                <label>Local
                  <input maxLength={200} value={newActivity.location}
                    onChange={e => setNewActivity(v => ({ ...v, location: e.target.value }))} />
                </label>
                <label>Início previsto
                  <input required type="date" value={newActivity.startDate}
                    onChange={e => setNewActivity(v => ({ ...v, startDate: e.target.value }))} />
                </label>
                <label>Fim previsto
                  <input required type="date" min={newActivity.startDate || undefined} value={newActivity.endDate}
                    onChange={e => setNewActivity(v => ({ ...v, endDate: e.target.value }))} />
                </label>
                <label>Atletas previstos (sem nomes)
                  <input required type="number" min={0} max={200} step={1}
                    value={newActivity.expectedAthleteCount}
                    onChange={e => setNewActivity(v => ({ ...v, expectedAthleteCount: Number(e.target.value) }))} />
                </label>
                <button type="submit" disabled={busy || classes.length === 0}>Guardar atividade</button>
              </form>
            </section>}
            <form className="private-range" onSubmit={loadActivities}>
              <label>De<input type="date" required value={range.from}
                onChange={e => setRange(v => ({ ...v, from: e.target.value }))} /></label>
              <label>Até<input type="date" required value={range.to}
                onChange={e => setRange(v => ({ ...v, to: e.target.value }))} /></label>
              <button disabled={busy}>Consultar</button>
            </form>
            {truncated && <p className="private-warning">A lista ultrapassa 500 atividades; reduz o intervalo.</p>}
            <div className="private-panel">
              <h2>Resultados <span>{items.length} atividades</span></h2>
              {items.length === 0
                ? <p className="private-empty">Sem resultados apresentados. Seleciona um período e carrega em Consultar.</p>
                : <div className="private-table-scroll"><table><thead><tr>
                  <th>Atividade</th><th>Classe</th><th>Período</th><th>Local</th><th>Estado</th>
                </tr></thead><tbody>{items.map(item => <tr key={item.id}>
                  <td><strong>{item.title}</strong><small>{item.leadCoach.fullName}</small></td>
                  <td>{item.sailingClass.code}</td>
                  <td>{day(item.startDate)} – {day(item.endDate)}</td>
                  <td>{item.location ?? 'Por definir'}</td>
                  <td>{item.status}{item.monthlyConfirmed ? ' · Mensal confirmado' : ''}</td>
                </tr>)}</tbody></table></div>}
            </div>
            <p className="private-muted">Os treinadores podem registar atividades de teste. A edição e a confirmação mensal serão integradas a seguir, mantendo o histórico no servidor.</p>
          </>}

          {admin && tab === 'accounts' && <>
            <h1>Contas e treinadores</h1>
            <p className="private-muted">Gerir as classes atribuídas e o estado das contas de teste.</p>
            <div className="private-two-col">
              <section className="private-panel">
                <h2>Contas <span>{accounts.length}</span></h2>
                {accounts.map(account => <button key={account.id} type="button"
                  className={'private-account ' + (selectedId === account.id ? 'chosen' : '')}
                  onClick={() => setSelectedId(account.id)}>
                  <strong>{account.fullName}</strong><small>{account.role} · {account.active ? 'Ativa' : 'Inativa'}</small>
                </button>)}
                {accounts.length === 0 && <p className="private-empty">Sem contas carregadas.</p>}
              </section>
              <section className="private-panel">
                {selected ? <>
                  <h2>{selected.fullName}</h2>
                  <p className="private-muted">{selected.email} · {selected.role} · versão {selected.authzVersion}</p>
                  {selected.role === 'COACH' ? <>
                    <div className="private-choices">
                      {classes.filter(item => item.active).map(item => <label key={item.id}>
                        <input type="checkbox" checked={draftClasses.includes(item.id)}
                          onChange={e => setDraftClasses(prev => e.target.checked
                            ? [...prev.filter(id => id !== item.id), item.id]
                            : prev.filter(id => id !== item.id))} />
                        {item.code}
                      </label>)}
                    </div>
                    <button type="button" disabled={busy}
                      onClick={saveAssignment}>Guardar classes atribuídas</button>
                  </> : <p className="private-muted">Atribuição de classes disponível apenas para contas de treinador.</p>}
                  {selected.role !== 'ADMIN' && <button type="button"
                    className="private-secondary private-danger" disabled={busy}
                    onClick={() => toggleAccount(selected)}>
                    {selected.active ? 'Desativar e revogar sessões' : 'Reativar conta'}
                  </button>}
                </> : <p className="private-empty">Seleciona uma conta na lista.</p>}
              </section>
            </div>
            <section className="private-panel">
              <h2>Criar conta de teste</h2>
              <form className="private-grid-form" onSubmit={createAccount}>
                <label>Nome<input required value={newName} maxLength={160}
                  onChange={e => setNewName(e.target.value)} /></label>
                <label>Email<input required type="email" value={newEmail}
                  onChange={e => setNewEmail(e.target.value)} placeholder="novo@fpv.invalid" /></label>
                <label>Password inicial (14+ caracteres)
                  <input required type="password" minLength={14} autoComplete="new-password"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
                <label>Perfil<select value={newRole}
                  onChange={e => setNewRole(e.target.value as typeof newRole)}>
                  <option value="COACH">Treinador</option>
                  <option value="COORDINATOR">Coordenação</option>
                  <option value="VIEWER">Consulta</option>
                </select></label>
                <button disabled={busy} type="submit">Criar conta de teste</button>
              </form>
            </section>
          </>}

          {admin && tab === 'classes' && <>
            <h1>Classes de vela</h1>
            <p className="private-muted">Catálogo guardado no PostgreSQL privado.</p>
            <section className="private-panel">
              <h2>Classes registadas <span>{classes.length}</span></h2>
              <div className="private-classes">{classes.map(item =>
                <div key={item.id}><strong>{item.code}</strong><span>{item.name}</span>
                  <small>{item.active ? 'Ativa' : 'Inativa'}</small></div>)}</div>
              {classes.length === 0 && <p className="private-empty">Nenhuma classe registada.</p>}
            </section>
            <section className="private-panel">
              <h2>Adicionar classe</h2>
              <form className="private-grid-form" onSubmit={createClass}>
                <label>Código<input required maxLength={40} value={classCode}
                  onChange={e => setClassCode(e.target.value)} placeholder="ILCA 7" /></label>
                <label>Designação<input required maxLength={120} value={className}
                  onChange={e => setClassName(e.target.value)} placeholder="ILCA 7" /></label>
                <button disabled={busy} type="submit">Criar classe</button>
              </form>
            </section>
          </>}
          <footer>Versão privada de desenvolvimento · utilizar apenas dados fictícios · sem produção</footer>
        </section>
      </div>
    </main>
  );
}
