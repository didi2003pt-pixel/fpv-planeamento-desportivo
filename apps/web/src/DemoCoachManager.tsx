import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fpvReferenceClasses } from './exportClassMap';
import type { DemoCoach } from './demoCoaches';

interface Props {
  coaches: DemoCoach[];
  onSave: (id: string, classes: string[]) => void;
  onAddExample: () => void;
  onClose: () => void;
}

export default function DemoCoachManager({ coaches, onSave, onAddExample, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState(coaches[0]?.id ?? '');
  const selected = coaches.find((coach) => coach.id === selectedId) ?? coaches[0];
  const [assigned, setAssigned] = useState<string[]>(selected?.sailingClasses ?? []);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  useEffect(() => {
    setAssigned(selected?.sailingClasses ?? []);
    setMessage('');
  }, [selected?.id, selected?.sailingClasses]);

  function toggle(item: string, value: boolean) {
    setAssigned((current) => value ? [...current.filter((c) => c !== item), item] :
      current.filter((c) => c !== item));
    setMessage('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    onSave(selected.id, assigned);
    setMessage('Atribuições atualizadas apenas nesta sessão de demonstração.');
  }

  return (
    <dialog ref={dialogRef} className="activity-modal coach-dialog"
      aria-labelledby="demo-coach-title" onCancel={onClose}>
      <div className="modal-heading">
        <div>
          <span className="modal-eyebrow">FPV · SIMULAÇÃO</span>
          <h2 id="demo-coach-title">Treinadores e classes</h2>
          <p>Experimenta a distribuição das classes pelos treinadores fictícios.</p>
        </div>
        <button type="button" className="modal-close" aria-label="Fechar gestão"
          onClick={onClose}>×</button>
      </div>
      <div className="modal-warning" role="note">
        <strong>Não é um sistema de permissões real.</strong> Não existem contas, passwords
        nem armazenamento central. Não coloques nomes verdadeiros nesta demonstração pública.
      </div>
      <div className="coach-manager-body">
        <div className="coach-list">
          <div className="coach-list-heading">TREINADORES DE EXEMPLO</div>
          {coaches.map((coach) => (
            <button type="button" key={coach.id} onClick={() => setSelectedId(coach.id)}
              className={'coach-item ' + (selected?.id === coach.id ? 'active' : '')}>
              <strong>{coach.name}</strong>
              <span>{coach.sailingClasses.length} classes atribuídas</span>
            </button>
          ))}
          <button type="button" className="coach-add" onClick={() => {
            onAddExample();
            setMessage('Novo treinador fictício criado. Seleciona-o na lista para atribuir classes.');
          }}>+ Adicionar treinador fictício</button>
        </div>
        <form className="coach-assignments" onSubmit={submit}>
          <h3>{selected?.name ?? 'Seleciona um treinador'}</h3>
          <p>Seleciona as classes que este treinador pode consultar e planear na simulação.</p>
          <div className="coach-assignment-tools">
            <button type="button" onClick={() => setAssigned([...fpvReferenceClasses])}>Selecionar todas</button>
            <button type="button" onClick={() => setAssigned([])}>Limpar seleção</button>
          </div>
          <div className="coach-class-grid">
            {fpvReferenceClasses.map((item) => (
              <label key={item} className="coach-class-choice">
                <input type="checkbox" checked={assigned.includes(item)}
                  onChange={(e) => toggle(item, e.target.checked)} />
                <span>{item}</span>
              </label>
            ))}
          </div>
          <div className="coach-form-bottom">
            <span className="coach-class-count">{assigned.length} classes selecionadas</span>
            <button type="submit" className="form-primary" disabled={!selected}>Guardar atribuições</button>
          </div>
          {message && <p className="coach-message" role="status">{message}</p>}
        </form>
      </div>
    </dialog>
  );
}
