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

const sailingClasses = [...fpvReferenceClasses];
const dateFormatter = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });

function prettyDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}

function ActivityDetail({ activity }: { activity: DemoActivity | undefined }) {
  if (!activity) {
    return <div className="empty-detail">Seleciona uma atividade no calendário para ver os detalhes.</div>;
  }
  const meta = typeMeta[activity.type];
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
      <p className="demo-footnote">Dados apenas de demonstração · ainda sem edição nem gravação definitiva.</p>
    </section>
  );
}

function App() {
  const calendarRef = useRef<FullCalendar>(null);
  const [allActivities, setAllActivities] = useState<DemoActivity[]>(() => demoActivities());
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedId, setSelectedId] = useState('01');
  const [viewType, setViewType] = useState('dayGridMonth');
  const [calendarTitle, setCalendarTitle] = useState('');
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

  const filtered = useMemo(() => allActivities.filter((a) =>
    (selectedClass === 'ALL' || a.sailingClass === selectedClass) &&
    (selectedType === 'ALL' || a.type === selectedType),
  ), [allActivities, selectedClass, selectedType]);

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

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0];
  const currentClasses = new Set(filtered.map((a) => a.sailingClass)).size;

  function addActivity(activity: DemoActivity) {
    setAllActivities((current) => [...current, activity]);
    setSelectedClass('ALL');
    setSelectedType('ALL');
    setSelectedId(activity.id);
    calendarRef.current?.getApi().gotoDate(activity.start);
    setCreatingFor(null);
    setNotice('Atividade de demonstração adicionada. Já aparece no calendário e na exportação Excel desta sessão.');
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
    { label: 'Atividades', number: filtered.length, symbol: '▦', tone: 'blue' },
    { label: 'Classes', number: currentClasses, symbol: '◈', tone: 'teal' },
    { label: 'Estágios', number: filtered.filter((a) => a.type === 'CAMP').length, symbol: '⚑', tone: 'violet' },
    { label: 'Competições', number: filtered.filter((a) => a.type === 'COMPETITION').length, symbol: '✦', tone: 'amber' },
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
        <div className="nav-section-title muted-nav-title">EM PREPARAÇÃO</div>
        <div className="nav-inactive"><span>◫</span> Gestão de atividades</div>
        <div className="nav-inactive"><span>♙</span> Treinadores e classes</div>
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
                onClick={() => { setNotice(''); setCreatingFor(formatISO(calendarRef.current?.getApi().getDate() ?? new Date())); }}>
                <span aria-hidden="true">＋</span> Nova atividade
              </button>
              <button type="button" className="export-button" onClick={downloadExcel} disabled={exporting}>
                <span aria-hidden="true">⇩</span> {exporting ? 'A preparar Excel…' : 'Exportar Excel'}
              </button>
            </div>
          </div>

          <div className="disclaimer"><strong>Modo de demonstração pública:</strong> os exemplos iniciais são fictícios. Não introduzas nomes nem dados pessoais reais. Os novos registos ficam apenas nesta página enquanto estiver aberta; perdem-se ao atualizar.</div>
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
                <div><h2>Calendário de atividades</h2><p>Seleciona uma atividade para ver os detalhes.</p></div>
              </div>
              <div className="filter-row">
                <label className="filter-field"><span>Classe</span>
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    <option value="ALL">Todas as classes</option>
                    {sailingClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="filter-field"><span>Atividade</span>
                  <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                    <option value="ALL">Todos os tipos</option>
                    {(Object.keys(typeMeta) as ActivityType[]).map((key) =>
                      <option key={key} value={key}>{typeMeta[key].label}</option>)}
                  </select>
                </label>
                <div className="filter-result">{filtered.length} atividades na demonstração</div>
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
                  dateClick={(info) => { setNotice(''); setCreatingFor(info.dateStr); }}
                  datesSet={(info) => { setCalendarTitle(info.view.title); setViewType(info.view.type); }}
                />
              </div>
              <div className="calendar-legend">
                {Object.entries(typeMeta).map(([key, item]) =>
                  <span key={key}><i style={{ background: item.color }} />{item.label}</span>)}
              </div>
            </div>

            <aside className="detail-panel">
              <div className="detail-title"><h2>Detalhes da atividade</h2><span>◉</span></div>
              <ActivityDetail activity={selected} />
            </aside>
          </section>
          <footer>FPV Planeamento Desportivo · Protótipo de avaliação · Não utilizar para dados reais.</footer>
          {creatingFor && <CreateActivityDialog startDate={creatingFor}
            onCreate={addActivity} onClose={() => setCreatingFor(null)} /> }
        </main>
      </div>
    </div>
  );
}

export default App;
