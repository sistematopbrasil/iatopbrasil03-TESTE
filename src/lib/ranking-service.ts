import { supabase } from '@/integrations/supabase/client';

// Points configuration
export const POINTS_CONFIG = {
  lead_captured: 10,
  lead_hot: 20,
  lead_warm: 10,
  lead_contacted: 15,
  lead_qualified: 25,
  lead_converted: 100,
  consultant_recruited: 200,
  event_hosted: 30,
};

// Lead temperature points for ranking display
export const LEAD_TEMPERATURE_POINTS = {
  cold: 5,    // Lead frio (não completou quiz ou baixa qualidade)
  warm: 15,   // Lead morno (completou quiz)
  hot: 30,    // Lead quente (completou + critérios ideais)
};

// Calculate total points based on lead temperatures
export function calculateLeadPoints(hotCount: number, warmCount: number, coldCount: number): number {
  return (
    (hotCount * LEAD_TEMPERATURE_POINTS.hot) +
    (warmCount * LEAD_TEMPERATURE_POINTS.warm) +
    (coldCount * LEAD_TEMPERATURE_POINTS.cold)
  );
}

export type RankingAction = keyof typeof POINTS_CONFIG;

export interface UserLevel {
  level: string;
  badge: string;
  color: string;
  minPoints: number;
  maxPoints: number | null;
  bonus: string;
}

const LEVELS: UserLevel[] = [
  { level: 'Elite', badge: '👑', color: 'text-purple-600', minPoints: 10000, maxPoints: null, bonus: '+20% comissão' },
  { level: 'Diamante', badge: '💎', color: 'text-blue-600', minPoints: 5000, maxPoints: 9999, bonus: '+15% comissão' },
  { level: 'Ouro', badge: '🥇', color: 'text-yellow-600', minPoints: 1500, maxPoints: 4999, bonus: '+10% comissão' },
  { level: 'Prata', badge: '🥈', color: 'text-gray-500', minPoints: 500, maxPoints: 1499, bonus: '+5% comissão' },
  { level: 'Bronze', badge: '🥉', color: 'text-orange-600', minPoints: 0, maxPoints: 499, bonus: 'Acesso básico' },
];

export function getUserLevel(points: number): UserLevel {
  for (const level of LEVELS) {
    if (points >= level.minPoints) {
      return level;
    }
  }
  return LEVELS[LEVELS.length - 1];
}

export function getNextLevel(points: number): UserLevel | null {
  const currentLevel = getUserLevel(points);
  const currentIndex = LEVELS.indexOf(currentLevel);
  
  if (currentIndex > 0) {
    return LEVELS[currentIndex - 1];
  }
  return null;
}

export function getProgressToNextLevel(points: number): number {
  const currentLevel = getUserLevel(points);
  const nextLevel = getNextLevel(points);
  
  if (!nextLevel) return 100;
  
  const pointsInCurrentLevel = points - currentLevel.minPoints;
  const pointsNeededForNext = nextLevel.minPoints - currentLevel.minPoints;
  
  return Math.min(100, Math.round((pointsInCurrentLevel / pointsNeededForNext) * 100));
}

export function calculateTotalPoints(metrics: {
  leads_captured: number;
  leads_contacted: number;
  leads_qualified: number;
  leads_converted: number;
  consultants_recruited: number;
  events_hosted: number;
}): number {
  return (
    (metrics.leads_captured || 0) * POINTS_CONFIG.lead_captured +
    (metrics.leads_contacted || 0) * POINTS_CONFIG.lead_contacted +
    (metrics.leads_qualified || 0) * POINTS_CONFIG.lead_qualified +
    (metrics.leads_converted || 0) * POINTS_CONFIG.lead_converted +
    (metrics.consultants_recruited || 0) * POINTS_CONFIG.consultant_recruited +
    (metrics.events_hosted || 0) * POINTS_CONFIG.event_hosted
  );
}

export async function getUserRankingMetrics(consultantId: string, organizationId: string) {
  try {
    // Get current period (current month)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('ranking_scores')
      .select('*')
      .eq('consultant_id', consultantId)
      .eq('organization_id', organizationId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .maybeSingle();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching ranking metrics:', error);
    return null;
  }
}

export async function getOrganizationRanking(organizationId: string) {
  try {
    const { data, error } = await supabase
      .from('ranking_scores')
      .select(`
        *,
        consultant:consultant_id (
          id,
          full_name,
          email
        )
      `)
      .eq('organization_id', organizationId)
      .order('total_points', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching organization ranking:', error);
    return [];
  }
}
