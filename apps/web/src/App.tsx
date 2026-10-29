import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import ptLocale from '@fullcalendar/core/locales/pt';
import type { EventInput } from '@fullcalendar/core';
import {
  addDays, demoActivities, formatISO, statusLabel, typeMeta,
  type ActivityType, type DemoActivity,
} from './demo';
import { exportDemoExcel } from './exportExcel';
import { fpvReferenceClasses } from './exportClassMap';
import CreateActivityDialog from './CreateActivityDialog';
import DemoCoachManager from './DemoCoachManager';
import {
  FEDERATION_VIEW, activitiesForDemoView, appendFictitiousCoach,
  assignDemoCoachClasses, classesForDemoView, demoCoachNameForClass,
  initialDemoCoaches, type DemoCoach,
} from './demoCoaches';
import { changeDemoActivityStatus } from './activityDraft';
import { activitiesInPeriod, civilDate, periodFromMonth } from './calendarPeriod';
import { annualPlanDates, monthlyDatesDiffer } from './monthlyPlan';
import ConfirmMonthlyDialog from './ConfirmMonthlyDialog';

const sailingClasses = [...fpvReferenceClasses];
const dateFormatter = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });

function prettyDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

function ActivityDetail({
  activity, onEdit, onToggleCancelled, onConfirmMonthly,
}: {
  activity: DemoActivity | undefined;
  onEdit: (activity: DemoActivity) => void;
  onToggleCancelled: (activity: DemoActivity) => void;
  onConfirmMonthly: (activity: DemoActivity) => void;
}) {
  if (!activity) {
    return <div className="empty-detail">Seleciona uma atividade no calendário para ver os detalhes.</div>;
  }
  const meta = typeMeta[activity.type];
  const annual = annualPlanDates(activity);
  const changed = monthlyDatesDiffer(activity);
  return (
    <section className="activity-detail">
      <div className="detail-topline">
        <span className="type-chip" style={{ background: meta.color + '16', color: meta.color }}>{meta.label}</span>
        <span className="small-status">{statusLabel[activity.status]}</span>
      </div>
      <h3>{activity.title}</h3>
      <p className="muted detail-class">{activity.sailingClass}</p>
      <div className="detail-divider" />
      <div className="detail-fields">
        <div><span className="detail-label">Datas</span><strong>{prettyDate(activity.start)} — {prettyDate(activity.end)}</strong></div>
        <div><span className="detail-label">Local</span><strong>{activity.location}</strong></div>
        <div><span className="detail-label">Responsável</span><strong>{activity.coach}</strong></div>
      </div>
      <div className="detail-divider" />
      <div className="monthly-summary">
        <div className="monthly-summary-header">
          <strong>Planeamento anual / mensal</strong>
          <span className={activity.monthlyConfirmed ? 'monthly-status done' : 'monthly-status'}>
            {activity.monthlyConfirmed ? 'Mês confirmado' : 'Por confirmar'}
          </span>
        </div>
        <div><span>Previsão anual</span><strong>{prettyDate(annual.start)} — {prettyDate(annual.end)}</strong></div>
        <div><span>Datas atuais</span><strong>{prettyDate(activity.start)} — {prettyDate(activity.end)}</strong></div>
        {activity.monthlyConfirmed && <p>
          {changed ? 'As datas foram revistas face ao plano anual.' : 'Confirmado sem alterar as datas previstas.'}
        </p>}
      </div>
      <div className="detail-divider" />
      <div className="athlete-heading">
        <div><span className="detail-label">Atletas previstos</span><strong className="athlete-number">{activity.expectedAthletes}</strong></div>
        <div><span className="detail-label">Nomes indicados</span><strong className="athlete-number">{activity.participants.length}</strong></div>
      </div>
      {activity.participants.length > 0 ? (
        <ul className="athlete-list">
          {activity.participants.map((name) => <li key={name}><span className="avatar-dot">A</span>{name}</li>)}
        </ul>
      ) : <p className="muted note">Os nomes dos participantes ainda não foram indicados.</p>}
      {activity.expectedAthletes > activity.participants.length &&
        <p className="subtle-note">Faltam indicar {activity.expectedAthletes - activity.participants.length} nomes previstos.</p>}
      <div className="detail-actions">
        <button type="button" className="detail-monthly"
          disabled={activity.status === 'CANCELLED' || activity.status === 'COMPLETED'}
          onClick={() => onConfirmMonthly(activity)}>
          {activity.monthlyConfirmed ? 'Rever plano mensal' : 'Confirmar plano mensal'}
        </button>
        <button type="button" className="detail-edit" onClick={() => onEdit(activity)}>
          Editar atividade
        </button>
        <button type="button"
          className={activity.status === 'CANCELLED' ? 'detail-restore' : 'detail-cancel'}
          onClick={() => onToggleCancelled(activity)}>
          {activity.status === 'CANCELLED' ? 'Reativar como previsto' : 'Cancelar atividade'}
        </button>
      </div>
      <p className="demo-footnote">Edição e cancelamento temporários: as alterações não ficam guardadas num servidor.</p>
    </section>
  );
}

function App() {
  const calendarRef = useRef<FullCalendar>(null);
  const [coaches, setCoaches] = useState<DemoCoach[]>(initialDemoCoaches);
  const [viewId, setViewId] = useState(FEDERATION_VIEW);
  const [showCoachManager, setShowCoachManager] = useState(false);
  const [allActivities, setAllActivities] = useState<DemoActivity[]>(() => {
    const initial = initialDemoCoaches();
    return demoActivities().map((activity) => ({
      ...activity, coach: demoCoachNameForClass(initial, activity.sailingClass),
    }));
  });
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [monthlyId, setMonthlyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedId, setSelectedId] = useState('01');
  const [viewType, setViewType] = useState('dayGridMonth');
  const [calendarTitle, setCalendarTitle] = useState('');
  const [visiblePeriod, setVisiblePeriod] = useState(() => periodFromMonth(new Date()));
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline' | 'demo'>(import.meta.env.MODE === 'pages' ? 'demo' : 'checking');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (import.meta.env.MODE === 'pages') return;
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error('API indisponível'); return res.json(); })
      .then((data: { status?: string }) => setApiStatus(data.status === 'ok' ? 'online' : 'offline'))
      .catch(() => { if (!controller.signal.aborted) setApiStatus('offline'); });
    return () => controller.abort();
  }, []);

  const allowedClasses = useMemo(() =>
    classesForDemoView(viewId, coaches), [viewId, coaches]);
  const activeCoach = coaches.find((coach) => coach.id === viewId);
  const filtered = useMemo(() =>
    activitiesForDemoView(allActivities, viewId, coaches).filter((activity) =>
      (selectedClass === 'ALL' || activity.sailingClass === selectedClass)
      && (selectedType === 'ALL' || activity.type === selectedType)),
    [allActivities, viewId, coaches, selectedClass, selectedType]);

  const entries: EventInput[] = useMemo(() => filtered.map((a) => ({
    id: a.id,
    title: a.sailingClass + ' · ' + a.title,
    start: a.start,
    end: addDays(a.end, 1), // FullCalendar trata a data final como exclusiva.
    allDay: true,
    backgroundColor: typeMeta[a.type].color,
    borderColor: typeMeta[a.type].color,
    classNames: a.status === 'CANCELLED' ? ['event-cancelled'] : [],
  })), [filtered]);

  const visibleActivities = useMemo(() => activitiesInPeriod(filtered, visiblePeriod),
    [filtered, visiblePeriod]);
  const selected = visibleActivities.find((a) => a.id === selectedId) ?? visibleActivities[0];
  const currentClasses = new Set(visibleActivities.map((a) => a.sailingClass)).size;
  const editingActivity = editingId ? allActivities.find((a) => a.id === editingId) : undefined;
  const monthlyActivity = monthlyId ? allActivities.find((a) => a.id === monthlyId) : undefined;

  function addActivity(activity: DemoActivity) {
    if (allowedClasses !== null && !allowedClasses.includes(activity.sailingClass)) return;
    const owner = activeCoach?.name ?? demoCoachNameForClass(coaches, activity.sailingClass);
    setAllActivities((current) => [...current, { ...activity, coach: owner }]);
    setSelectedClass('ALL');
    setSelectedType('ALL');
    setSelectedId(activity.id);
    calendarRef.current?.getApi().gotoDate(activity.start);
    setCreatingFor(null);
    setNotice('Atividade de demonstração adicionada. Já aparece no calendário e na exportação Excel desta sessão.');
  }

  function saveEditedActivity(activity: DemoActivity) {
    if (allowedClasses !== null && !allowedClasses.includes(activity.sailingClass)) return;
    setAllActivities((current) => current.map((item) => item.id === activity.id ? activity : item));
    setSelectedClass('ALL');
    setSelectedType('ALL');
    setSelectedId(activity.id);
    calendarRef.current?.getApi().gotoDate(activity.start);
    setEditingId(null);
    setNotice('Alterações aplicadas nesta sessão: calendário e Excel atualizados. Não ficam guardadas online.');
  }

  function saveMonthlyPlan(activity: DemoActivity) {
    if (allowedClasses !== null && !allowedClasses.includes(activity.sailingClass)) return;
    setAllActivities((current) => current.map((item) => item.id === activity.id ? activity : item));
    setSelectedId(activity.id);
    calendarRef.current?.getApi().gotoDate(activity.start);
    setMonthlyId(null);
    setNotice('Plano mensal confirmado nesta sessão. O calendário e o Excel usam as datas revistas; o plano anual foi preservado.');
  }

  function toggleCancelled(activity: DemoActivity) {
    if (allowedClasses !== null && !allowedClasses.includes(activity.sailingClass)) return;
    const cancelled = activity.status === 'CANCELLED';
    if (!cancelled && !window.confirm(
      'Cancelar "' + activity.title + '"? A atividade ficará assinalada como cancelada no calendário e no Excel desta sessão.',
    )) return;
    const updated = changeDemoActivityStatus(activity, cancelled ? 'PLANNED' : 'CANCELLED');
    setAllActivities((current) => current.map((item) => item.id === updated.id ? updated : item));
    setSelectedId(updated.id);
    setNotice(cancelled
      ? 'Atividade reativada como prevista nesta sessão (não confirmada).'
      : 'Atividade cancelada nesta sessão. Não foi eliminada e mantém os seus dados.');
  }

  function chooseDemoView(nextId: string) {
    setViewId(nextId);
    setSelectedClass('ALL');
    setSelectedType('ALL');
    setSelectedId('');
    setNotice(nextId === FEDERATION_VIEW
      ? 'Vista geral da Federação: todas as classes, apenas nesta simulação.'
      : 'Vista de treinador simulada: apenas classes atribuídas. Isto não é um login nem uma proteção de dados.');
  }

  function changeView(view: string) {
    calendarRef.current?.getApi().changeView(view);
  }

  function move(direction: 'prev' | 'next' | 'today') {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api[direction]();
  }

  async function downloadExcel() {
    if (exporting) return;
    setExporting(true);
    try {
      const current = calendarRef.current?.getApi().getDate() ?? new Date();
      const yearView = viewType === 'multiMonthYear';
      const from = yearView ? new Date(current.getFullYear(), 0, 1) : new Date(current.getFullYear(), current.getMonth(), 1);
      const to = yearView ? new Date(current.getFullYear() + 1, 0, 1) : new Date(current.getFullYear(), current.getMonth() + 1, 1);
      const monthEvents = filtered.filter((a) => a.start < [
        to.getFullYear(), String(to.getMonth() + 1).padStart(2, '0'), String(to.getDate()).padStart(2, '0'),
      ].join('-') && a.end >= [
        from.getFullYear(), String(from.getMonth() + 1).padStart(2, '0'), String(from.getDate()).padStart(2, '0'),
      ].join('-'));
      await exportDemoExcel(monthEvents, current, yearView);
    } catch (error) {
      console.error('Erro na exportação XLSX', error);
      window.alert('Não foi possível exportar o Excel. Verifica a consola e tenta novamente.');
    } finally {
      setExporting(false);
    }
  }

  const stats = [
    { label: 'Atividades', number: visibleActivities.length, symbol: '▦', tone: 'blue' },
    { label: 'Classes', number: currentClasses, symbol: '◈', tone: 'teal' },
    { label: 'Estágios', number: visibleActivities.filter((a) => a.type === 'CAMP').length, symbol: '⚑', tone: 'violet' },
    { label: 'Competições', number: visibleActivities.filter((a) => a.type === 'COMPETITION').length, symbol: '✦', tone: 'amber' },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">◢</div>
          <div><span className="brand-name">FPV</span><span className="brand-subtitle">Planeamento Desportivo</span></div>
        </div>
        <div className="nav-section-title">PLATAFORMA</div>
        <div className="nav-active"><span>▦</span> Calendário geral</div>
        {import.meta.env.MODE !== 'pages' && (
          <a className="nav-inactive private-entry-link" href="/gestao">
            <span>♙</span> Acesso privado (Docker)
          </a>
        )}
        <div className="nav-section-title muted-nav-title">EM PREPARAÇÃO</div>
        <div className="nav-inactive"><span>◫</span> Gestão de atividades</div>
        <button type="button" className="nav-inactive nav-action"
          disabled={viewId !== FEDERATION_VIEW}
          title={viewId !== FEDERATION_VIEW ? 'Escolhe a vista Federação para gerir as atribuições da demonstração.' : ''}
          onClick={() => setShowCoachManager(true)}>
          <span>♙</span> Treinadores e classes
        </button>
        <div className="nav-inactive"><span>♧</span> Atletas</div>
        <div className="nav-inactive"><span>▤</span> Relatórios</div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">AMBIENTE DE DEMONSTRAÇÃO</div>
          <p>Sem autenticação nem dados reais. A gestão de acessos será implementada antes do piloto.</p>
          <div className="sidebar-divider" />
          <div className="sidebar-version">Versão 0.1.0 · INC-001</div>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="breadcrumbs">Plataforma <span>/</span> <strong>Calendário</strong></div>
          <div className="topbar-right">
            <label className="demo-view-select">
              <span>Vista (simulação)</span>
              <select value={viewId} onChange={(event) => chooseDemoView(event.target.value)}>
                <option value={FEDERATION_VIEW}>Federação — todas</option>
                {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
              </select>
            </label>
            <span className={'connection-pill ' + apiStatus}><span className="status-light" />
              {apiStatus === 'demo' ? 'Demonstração online' : apiStatus === 'online' ? 'API ligada' : apiStatus === 'offline' ? 'API desligada' : 'A verificar API'}
            </span>
            <span className="prototype-tag">PROTÓTIPO</span>
          </div>
        </header>

        <main className="main">
          <div className="welcome">
            <div>
              <span className="eyebrow">FEDERAÇÃO PORTUGUESA DE VELA · CONCEITO</span>
              <h1>Planeamento desportivo</h1>
              <p>Uma visão clara das atividades, equipas e calendário das classes.</p>
            </div>
            <div className="welcome-actions">
              <button type="button" className="create-button"
                disabled={allowedClasses !== null && allowedClasses.length === 0}
                title={allowedClasses !== null && allowedClasses.length === 0 ? 'Sem classes atribuídas nesta vista de exemplo.' : ''}
                onClick={() => { setNotice(''); setCreatingFor(formatISO(calendarRef.current?.getApi().getDate() ?? new Date())); }}>
                <span aria-hidden="true">＋</span> Nova atividade
              </button>
              <button type="button" className="export-button" onClick={downloadExcel} disabled={exporting}>
                <span aria-hidden="true">⇩</span> {exporting ? 'A preparar Excel…' : 'Exportar Excel'}
              </button>
            </div>
          </div>

          <div className="disclaimer"><strong>Simulação pública, sem login:</strong> as vistas por treinador são apenas filtros visuais, não permissões de acesso. Não introduzas dados reais. Atribuições e atividades desaparecem ao atualizar a página.</div>
          {notice && <div className="create-notice" role="status">{notice}</div>}

          <div className="stats-grid">
            {stats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <div className={'stat-icon ' + stat.tone}>{stat.symbol}</div>
                <div><div className="stat-number">{stat.number}</div><div className="stat-label">{stat.label}</div></div>
              </div>
            ))}
          </div>

          <section className="workspace">
            <div className="calendar-panel">
              <div className="section-heading">
                <div><h2>Calendário de atividades</h2><p>Seleciona uma atividade para consultar, editar ou cancelar.</p></div>
                {viewId === FEDERATION_VIEW && <button type="button" className="coach-manager-mobile"
                  onClick={() => setShowCoachManager(true)}>Treinadores e classes</button>}
              </div>
              <div className="filter-row">
                <label className="filter-field"><span>Classe</span>
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    <option value="ALL">Todas as classes</option>
                    {sailingClasses.filter((c) => allowedClasses === null || allowedClasses.includes(c)).map((c) =>
                      <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="filter-field"><span>Atividade</span>
                  <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                    <option value="ALL">Todos os tipos</option>
                    {(Object.keys(typeMeta) as ActivityType[]).map((key) =>
                      <option key={key} value={key}>{typeMeta[key].label}</option>)}
                  </select>
                </label>
                <div className="filter-result">{visibleActivities.length} atividades neste {viewType === 'multiMonthYear' ? 'ano' : 'mês'}</div>
              </div>
              <div className="calendar-toolbar">
                <div className="date-nav">
                  <button type="button" onClick={() => move('prev')} aria-label="Período anterior">‹</button>
                  <button type="button" onClick={() => move('today')} className="today-button">Hoje</button>
                  <button type="button" onClick={() => move('next')} aria-label="Período seguinte">›</button>
                  <h3>{calendarTitle}</h3>
                </div>
                <div className="view-switch" role="group" aria-label="Vista do calendário">
                  <button type="button" className={viewType === 'dayGridMonth' ? 'selected' : ''} onClick={() => changeView('dayGridMonth')}>Mês</button>
                  <button type="button" className={viewType === 'multiMonthYear' ? 'selected' : ''} onClick={() => changeView('multiMonthYear')}>Ano</button>
                </div>
              </div>
              <div className="calendar-scroller">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, multiMonthPlugin, interactionPlugin]}
                  locale={ptLocale}
                  initialView="dayGridMonth"
                  firstDay={1}
                  headerToolbar={false}
                  multiMonthMaxColumns={2}
                  height="auto"
                  dayMaxEvents={3}
                  displayEventTime={false}
                  events={entries}
                  eventClick={(info) => setSelectedId(info.event.id)}
                  dateClick={(info) => {
                    if (allowedClasses !== null && allowedClasses.length === 0) return;
                    setNotice(''); setCreatingFor(info.dateStr);
                  }}
                  datesSet={(info) => {
                    setCalendarTitle(info.view.title);
                    setViewType(info.view.type);
                    const start = civilDate(info.view.currentStart);
                    const endExclusive = civilDate(info.view.currentEnd);
                    setVisiblePeriod((previous) =>
                      previous.start === start && previous.endExclusive === endExclusive
                        ? previous : { start, endExclusive });
                  }}
                />
              </div>
              <div className="calendar-legend">
                {Object.entries(typeMeta).map(([key, item]) =>
                  <span key={key}><i style={{ background: item.color }} />{item.label}</span>)}
              </div>
            </div>

            <aside className="detail-panel">
              <div className="detail-title"><h2>Detalhes da atividade</h2><span>◉</span></div>
              <ActivityDetail activity={selected}
                onEdit={(activity) => { setNotice(''); setCreatingFor(null); setEditingId(activity.id); }}
                onToggleCancelled={toggleCancelled}
                onConfirmMonthly={(activity) => {
                  setNotice('');
                  setEditingId(null);
                  setCreatingFor(null);
                  setMonthlyId(activity.id);
                }} />
            </aside>
          </section>
          <footer>FPV Planeamento Desportivo · Protótipo de avaliação · Não utilizar para dados reais.</footer>
          {creatingFor && <CreateActivityDialog key="new" startDate={creatingFor}
            allowedClasses={allowedClasses ?? undefined}
            onSave={addActivity} onClose={() => setCreatingFor(null)} />}
          {editingActivity && <CreateActivityDialog key={editingActivity.id}
            startDate={editingActivity.start} activity={editingActivity}
            allowedClasses={allowedClasses ?? undefined}
            onSave={saveEditedActivity} onClose={() => setEditingId(null)} />}
          {monthlyActivity && <ConfirmMonthlyDialog key={monthlyActivity.id}
            activity={monthlyActivity} onSave={saveMonthlyPlan}
            onClose={() => setMonthlyId(null)} />}
          {showCoachManager && viewId === FEDERATION_VIEW && (
            <DemoCoachManager coaches={coaches}
              onSave={(id, classes) => {
                setCoaches((current) => assignDemoCoachClasses(current, id, classes));
                setNotice('Associação de classes atualizada apenas nesta demonstração.');
              }}
              onAddExample={() => {
                setCoaches((current) => appendFictitiousCoach(current));
              }}
              onClose={() => setShowCoachManager(false)} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
