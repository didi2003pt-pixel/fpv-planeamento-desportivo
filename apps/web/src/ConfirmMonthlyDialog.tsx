import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DemoActivity } from './demo';
import { annualPlanDates, confirmMonthlyPlan } from './monthlyPlan';

interface Props {
  activity: DemoActivity;
  onSave: (updated: DemoActivity) => void;
  onClose: () => void;
}

export default function ConfirmMonthlyDialog({ activity, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const annual = annualPlanDates(activity);
  const [start, setStart] = useState(activity.start);
  const [end, setEnd] = useState(activity.end);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      onSave(confirmMonthlyPlan(activity, start, end));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível confirmar as datas.');
    }
  }

  return (
    <dialog ref={dialogRef} className="activity-modal monthly-dialog"
      aria-labelledby="monthly-title" onCancel={onClose}>
      <div className="modal-heading">
        <div>
          <span className="modal-eyebrow">FPV · PLANEAMENTO MENSAL (DEMONSTRAÇÃO)</span>
          <h2 id="monthly-title">{activity.monthlyConfirmed ? 'Rever confirmação mensal' : 'Confirmar plano mensal'}</h2>
          <p>{activity.sailingClass} · {activity.title}</p>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar confirmação">×</button>
      </div>
      <div className="modal-warning">
        Esta é uma simulação pública, sem login nem gravação. Utiliza apenas atividades fictícias.
      </div>
      <form className="activity-form" onSubmit={submit} noValidate>
        <div className="monthly-baseline form-wide">
          <strong>Previsão do plano anual</strong>
          <span>{annual.start} até {annual.end}</span>
          <small>Estas datas ficam preservadas para comparação.</small>
        </div>
        <label className="form-field">Início efetivo previsto *
          <input type="date" value={start} onChange={(e) => { setStart(e.target.value); setError(''); }} />
        </label>
        <label className="form-field">Fim efetivo previsto *
          <input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setError(''); }} />
        </label>
        <p className="monthly-explanation form-wide">
          Ao confirmar, o calendário e a exportação Excel passam a utilizar estas datas.
          A previsão anual mantém-se nos detalhes da atividade para comparar o que mudou.
        </p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button type="button" className="form-cancel" onClick={onClose}>Voltar</button>
          <button type="submit" className="form-primary">Confirmar plano mensal</button>
        </div>
      </form>
    </dialog>
  );
}
