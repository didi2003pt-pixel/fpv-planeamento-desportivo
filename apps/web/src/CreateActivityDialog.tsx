import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fpvReferenceClasses } from './exportClassMap';
import {
  activityToDraft, createDemoActivity, editDemoActivity, initialActivityDraft,
  parseParticipants, validateActivityDraft,
  type ActivityDraft,
} from './activityDraft';
import { statusLabel, typeMeta, type ActivityStatus, type ActivityType, type DemoActivity } from './demo';

interface Props {
  startDate: string;
  activity?: DemoActivity;
  allowedClasses?: string[];
  onSave: (activity: DemoActivity) => void;
  onClose: () => void;
}

export default function CreateActivityDialog({ startDate, activity, allowedClasses, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ActivityDraft>(() => {
    const draft = activity ? activityToDraft(activity) : initialActivityDraft(startDate);
    if (!activity && allowedClasses && allowedClasses.length > 0) {
      draft.sailingClass = allowedClasses[0];
    }
    return draft;
  });
  const [error, setError] = useState<string | null>(null);
  const count = parseParticipants(draft.participantLines).length;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function update<K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateActivityDraft(draft);
    if (allowedClasses && !allowedClasses.includes(draft.sailingClass)) {
      setError('Esta classe não está atribuída à vista do treinador selecionado.');
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    if (activity) {
      onSave(editDemoActivity(activity, draft));
    } else {
      // ID exclusivamente local para demonstração, não serve de identificador de produção.
      onSave(createDemoActivity(draft, 'demo-' + crypto.randomUUID()));
    }
  }

  return (
    <dialog className="activity-modal" ref={dialogRef} onCancel={onClose} aria-labelledby="activity-dialog-title">
      <div className="modal-heading">
        <div>
          <span className="modal-eyebrow">FPV · DEMONSTRAÇÃO</span>
          <h2 id="activity-dialog-title">{activity ? 'Editar atividade' : 'Nova atividade'}</h2>
          <p>{activity ? 'Atualiza datas, tipo, local, estado e atletas de demonstração.' : 'Experimenta o registo de um planeamento com dados inventados.'}</p>
        </div>
        <button type="button" className="modal-close" aria-label="Fechar formulário" onClick={onClose}>×</button>
      </div>
      <div className="modal-warning" role="note">
        Este protótipo é público e não tem login. <strong>Não introduzas nomes nem dados pessoais reais.</strong>
        As alterações são temporárias: desaparecem ao atualizar ou fechar a página.
      </div>
      <form onSubmit={submit} className="activity-form" noValidate>
        <label className="form-field form-wide">Título da atividade *
          <input maxLength={200} autoFocus placeholder="Ex.: Estágio de preparação (fictício)"
            value={draft.title} onChange={(e) => update('title', e.target.value)} />
        </label>
        <label className="form-field">Classe *
          <select value={draft.sailingClass} onChange={(e) => update('sailingClass', e.target.value)}>
            {fpvReferenceClasses.filter((item) => !allowedClasses || allowedClasses.includes(item)).map((item) =>
              <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="form-field">Tipo de atividade *
          <select value={draft.type} onChange={(e) => update('type', e.target.value as ActivityType)}>
            {(Object.keys(typeMeta) as ActivityType[]).map((item) =>
              <option key={item} value={item}>{typeMeta[item].label}</option>)}
          </select>
        </label>
        <label className="form-field">Início *
          <input type="date" value={draft.start} onChange={(e) => update('start', e.target.value)} />
        </label>
        <label className="form-field">Fim *
          <input type="date" value={draft.end} onChange={(e) => update('end', e.target.value)} />
        </label>
        <label className="form-field">Local
          <input placeholder="Ex.: Vilamoura" maxLength={200} value={draft.location}
            onChange={(e) => update('location', e.target.value)} />
        </label>
        <label className="form-field">Estado *
          <select value={draft.status}
            onChange={(e) => update('status', e.target.value as ActivityStatus)}>
            {(activity ? ['PLANNED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as ActivityStatus[]
              : ['PLANNED', 'CONFIRMED'] as ActivityStatus[]).map((item) =>
              <option key={item} value={item}>{statusLabel[item]}</option>)}
          </select>
        </label>
        <div className="form-section form-wide">
          <h3>Participantes <span>(apenas nomes fictícios)</span></h3>
          <div className="form-athletes">
            <label className="form-field">Número previsto de atletas *
              <input type="number" min={0} max={200} step={1}
                value={draft.expectedAthletes}
                onChange={(e) => update('expectedAthletes', e.target.value === '' ? -1 : Number(e.target.value))} />
            </label>
            <div className="athletes-indicator">
              <span>Nomes indicados</span>
              <strong>{count} / {draft.expectedAthletes >= 0 ? draft.expectedAthletes : '—'}</strong>
              <small>É possível indicar os nomes mais tarde.</small>
            </div>
          </div>
          <label className="form-field">Nomes dos atletas de exemplo (um por linha)
            <textarea rows={3} placeholder={'Atleta 01\nAtleta 02\nAtleta 03'}
              value={draft.participantLines}
              onChange={(e) => update('participantLines', e.target.value)} />
          </label>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button type="button" className="form-cancel" onClick={onClose}>Cancelar</button>
          <button type="submit" className="form-primary">{activity ? 'Guardar alterações' : '+ Adicionar ao calendário'}</button>
        </div>
      </form>
    </dialog>
  );
}
