// Tipos e labels compartilhados do sistema Dual-Funnel (Consultor / Associado)
export type FunnelType = 'consultor' | 'associado';

export const FUNNEL_LABELS: Record<FunnelType, string> = {
  consultor: 'Consultores',
  associado: 'Associados',
};

export const FUNNEL_VALUES: FunnelType[] = ['consultor', 'associado'];

export function isFunnelType(value: unknown): value is FunnelType {
  return value === 'consultor' || value === 'associado';
}
