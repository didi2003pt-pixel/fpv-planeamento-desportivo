/** Dados fictícios, calculados relativamente ao mês atual. Não representam planeamentos reais da FPV. */
export type ActivityType = 'CAMP' | 'COMPETITION' | 'TRAINING' | 'TRAVEL' | 'EDUCATION' | 'OTHER';
export type ActivityStatus = 'PLANNED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface DemoActivity {
  id: string;
  title: string;
  sailingClass: string;
  type: ActivityType;
  status: ActivityStatus;
  start: string; // ISO YYYY-MM-DD, inclusivo
  end: string; // ISO YYYY-MM-DD, inclusivo
  location: string;
  coach: string;
  expectedAthletes: number;
  participants: string[];
}

export const typeMeta: Record<ActivityType, { label: string; color: string }> = {
  CAMP: { label: 'Estágio', color: '#3b70df' },
  COMPETITION: { label: 'Competição', color: '#de962b' },
  TRAINING: { label: 'Treino', color: '#209c79' },
  TRAVEL: { label: 'Deslocação', color: '#9067d2' },
  EDUCATION: { label: 'Formação', color: '#1299ad' },
  OTHER: { label: 'Outro', color: '#66778c' },
};

export const statusLabel: Record<ActivityStatus, string> = {
  PLANNED: 'Previsto',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
  COMPLETED: 'Realizado',
};

export function formatISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return [year, month, day].join('-');
}

function makeDate(monthOffset: number, day: number): string {
  const today = new Date();
  return formatISO(new Date(today.getFullYear(), today.getMonth() + monthOffset, day));
}

export function addDays(iso: string, count: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return formatISO(new Date(year, month - 1, day + count));
}

export function demoActivities(): DemoActivity[] {
  const example = (id: string, title: string, sailingClass: string, type: ActivityType,
    month: number, first: number, last: number, location: string, expectedAthletes: number,
    participants: string[], status: ActivityStatus = 'PLANNED'): DemoActivity => ({
    id, title, sailingClass, type, start: makeDate(month, first), end: makeDate(month, last),
    location, expectedAthletes, participants, status, coach: 'Treinador de demonstração',
  });

  return [
    example('01', 'Estágio técnico', 'ILCA 7', 'CAMP', 0, 4, 9, 'Vilamoura', 5, ['Atleta 01', 'Atleta 02', 'Atleta 03'], 'CONFIRMED'),
    example('02', 'Treino de frota', 'ILCA 6', 'TRAINING', 0, 6, 8, 'Cascais', 6, ['Atleta 04', 'Atleta 05']),
    example('03', 'Regata de preparação', '470 MX', 'COMPETITION', 0, 11, 14, 'Lisboa', 4, ['Atleta 06', 'Atleta 07'], 'CONFIRMED'),
    example('04', 'Treinos de velocidade', '49er FX', 'TRAINING', 0, 18, 22, 'Portimão', 4, ['Atleta 08']),
    example('05', 'Estágio de preparação', 'IQFOIL', 'CAMP', 0, 23, 29, 'Lagos', 8, ['Atleta 09', 'Atleta 10']),
    example('06', 'Deslocação de equipa', 'ILCA 7', 'TRAVEL', 0, 27, 29, 'Faro', 5, ['Atleta 01', 'Atleta 02']),
    example('07', 'Formação técnica', 'Optimist', 'EDUCATION', 0, 15, 16, 'Lisboa', 12, []),
    example('08', 'Estágio de inverno', 'ILCA 7', 'CAMP', 1, 3, 10, 'Vilamoura', 5, ['Atleta 01', 'Atleta 02', 'Atleta 03']),
    example('09', 'Regata nacional', '49er FX', 'COMPETITION', 1, 12, 15, 'Cascais', 4, ['Atleta 08']),
    example('10', 'Treino de equipa', 'IQFOIL', 'TRAINING', 1, 19, 24, 'Viana do Castelo', 7, []),
    example('11', 'Treino cancelado', 'ILCA 6', 'TRAINING', 0, 25, 25, 'Cascais', 3, [], 'CANCELLED'),
  ];
}
