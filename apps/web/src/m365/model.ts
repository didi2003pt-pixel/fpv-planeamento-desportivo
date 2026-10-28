export type PlanningType = 'TRAINING'|'CAMP'|'COMPETITION'|'TRAVEL'|'EDUCATION'|'OTHER';
export type PlanningStatus = 'PLANNED'|'CONFIRMED'|'CANCELLED'|'COMPLETED';

export interface M365Activity {
  id: string; listId: string; etag: string;
  title: string; sailingClass: string; type: PlanningType;
  status: PlanningStatus; start: string; end: string;
  annualStart: string; annualEnd: string; monthlyConfirmed: boolean;
  location: string; expectedAthletes: number;
}
export interface M365Draft {
  title: string; type: PlanningType; start: string; end: string;
  location: string; expectedAthletes: number;
}
export const TYPES: { value: PlanningType; label: string }[] = [
  { value:'TRAINING', label:'Treino' }, { value:'CAMP', label:'Estágio' },
  { value:'COMPETITION', label:'Competição' }, { value:'TRAVEL', label:'Viagem' },
  { value:'EDUCATION', label:'Formação' }, { value:'OTHER', label:'Outro' },
];
const ISO = /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export function validDate(value: string): boolean {
  if (!ISO.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function validateDraft(value: M365Draft): string | null {
  if (!value.title.trim() || value.title.length > 200) return 'Título obrigatório (até 200 caracteres).';
  if (!TYPES.some(t => t.value === value.type)) return 'Tipo de atividade inválido.';
  if (!validDate(value.start) || !validDate(value.end) || value.start > value.end) return 'Indica datas válidas e ordenadas.';
  if (value.location.length > 200) return 'Local demasiado comprido.';
  if (!Number.isInteger(value.expectedAthletes) || value.expectedAthletes < 0 || value.expectedAthletes > 200) {
    return 'Número de atletas deve ser entre 0 e 200.';
  }
  return null;
}
