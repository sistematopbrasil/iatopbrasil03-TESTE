export interface QuizAnswers {
  age?: number;
  maritalStatus?: string;
  hasVehicle?: string;
  hasCNH?: string;
  employmentStatus?: string;
  salesExperience?: string;
  vehicleProtectionExperience?: string;
  currentIncome?: string;
  desiredIncome?: string;
}

export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface ScoreBreakdown {
  age: number;
  maritalStatus: number;
  vehicle: number;
  cnh: number;
  employment: number;
  sales: number;
  vehicleProtection: number;
  currentIncome: number;
  desiredIncome: number;
}

export interface LeadScore {
  total_score: number;
  max_score: number;
  percentage: number;
  temperature: LeadTemperature;
  breakdown: ScoreBreakdown;
}

export const MAX_LEAD_SCORE = 185;

/**
 * NOVA LÓGICA DE TEMPERATURA - TOP Brasil
 * 
 * 🧊 LEAD FRIO:
 *   - completion_percentage < 100 (não completou o quiz)
 * 
 * 🔥 LEAD QUENTE (REGRA 1 - DECISIVA):
 *   - vehicle_protection_experience contém "sim" ou "já trabalho" → QUENTE AUTOMÁTICO
 * 
 * 🔥 LEAD QUENTE (REGRA 2 - PONTUAÇÃO):
 *   - Completou o quiz + marcou 3 ou mais das 4 perguntas de peso positivamente
 * 
 * 🌡️ LEAD MORNO:
 *   - Completou o quiz (completion_percentage = 100)
 *   - NÃO trabalha com proteção veicular
 *   - Marcou menos de 3 das 4 perguntas de peso positivamente
 * 
 * Perguntas de Peso (1 ponto cada):
 *   - Casado(a)? (relationship_status)
 *   - Possui veículo? (has_vehicle)
 *   - Possui CNH? (has_driver_license)
 *   - Experiência em vendas? (sales_experience)
 */

export interface LeadData {
  completion_percentage: number;
  vehicle_protection_experience?: string | null;
  relationship_status?: string | null;
  has_vehicle?: string | null;
  has_driver_license?: string | null;
  sales_experience?: string | null;
}

/**
 * Calcula os pontos das perguntas-chave (máximo 4 pontos)
 */
export function calculateKeyQuestionPoints(lead: LeadData): number {
  let points = 0;

  // 1. Casado(a)? - 1 ponto
  const relationshipStatus = lead.relationship_status?.toLowerCase() || '';
  const isMarried = relationshipStatus.includes('casado');
  if (isMarried) {
    points++;
  }
  console.log('🔵 [KeyPoints] Casado?', { raw: lead.relationship_status, normalized: relationshipStatus, isMarried, points });

  // 2. Possui veículo? - 1 ponto
  const hasVehicle = lead.has_vehicle?.toLowerCase() || '';
  const hasVehicleMatch = hasVehicle.includes('carro') || hasVehicle.includes('moto') || hasVehicle.includes('ambos');
  if (hasVehicleMatch) {
    points++;
  }
  console.log('🔵 [KeyPoints] Veículo?', { raw: lead.has_vehicle, normalized: hasVehicle, hasVehicleMatch, points });

  // 3. Possui CNH? - 1 ponto
  const hasCNH = lead.has_driver_license?.toLowerCase() || '';
  const hasCNHMatch = hasCNH.includes('sim');
  if (hasCNHMatch) {
    points++;
  }
  console.log('🔵 [KeyPoints] CNH?', { raw: lead.has_driver_license, normalized: hasCNH, hasCNHMatch, points });

  // 4. Experiência em vendas? - 1 ponto
  const salesExp = lead.sales_experience?.toLowerCase() || '';
  const hasSalesExp = salesExp.includes('já trabalho') || salesExp.includes('já trabalhei');
  if (hasSalesExp) {
    points++;
  }
  console.log('🔵 [KeyPoints] Vendas?', { raw: lead.sales_experience, normalized: salesExp, hasSalesExp, points });

  console.log('🔵 [KeyPoints] TOTAL:', points);
  return points;
}

/**
 * Verifica se o lead trabalha/já trabalhou com proteção veicular (REGRA DECISIVA)
 */
export function worksWithVehicleProtection(vehicleProtectionExperience: string | null | undefined): boolean {
  if (!vehicleProtectionExperience) {
    console.log('🔵 [Protection] Sem experiência informada, retornando false');
    return false;
  }
  
  const experience = vehicleProtectionExperience.toLowerCase();
  const result = experience.includes('sim') || experience.includes('já trabalho');
  console.log('🔵 [Protection] Trabalha com proteção?', { raw: vehicleProtectionExperience, normalized: experience, result });
  return result;
}

/**
 * Nova função para calcular temperatura baseado nos critérios TOP Brasil
 */
export function calculateTemperature(lead: LeadData): LeadTemperature {
  console.log('🌡️ [Temperature] Calculando temperatura para:', JSON.stringify(lead, null, 2));
  
  // 🧊 REGRA 1: Frio se não completou o quiz
  if (lead.completion_percentage < 100) {
    console.log('🧊 [Temperature] FRIO - Não completou o quiz:', lead.completion_percentage);
    return 'cold';
  }

  // 🔥 REGRA 2 (DECISIVA): Quente automático se trabalha com proteção veicular
  const worksWithProtection = worksWithVehicleProtection(lead.vehicle_protection_experience);
  if (worksWithProtection) {
    console.log('🔥 [Temperature] QUENTE - Trabalha com proteção veicular');
    return 'hot';
  }

  // 🔥 REGRA 3: Quente por pontuação (3 ou mais pontos das perguntas-chave)
  const keyPoints = calculateKeyQuestionPoints(lead);
  console.log('🔵 [Temperature] Pontos-chave calculados:', keyPoints);
  if (keyPoints >= 3) {
    console.log('🔥 [Temperature] QUENTE - 3+ pontos nas perguntas-chave');
    return 'hot';
  }

  // 🌡️ REGRA 4: Morno - Completou mas não atingiu critérios quentes
  console.log('🌡️ [Temperature] MORNO - Completou mas não atingiu critérios quentes. Pontos:', keyPoints);
  return 'warm';
}

/**
 * Função auxiliar para compatibilidade com código existente
 * Converte parâmetros separados para objeto LeadData
 */
export function calculateTemperatureFromParams(
  completionPercentage: number,
  hasVehicle: string | null | undefined,
  hasCNH: string | null | undefined,
  salesExperience: string | null | undefined,
  vehicleProtectionExperience?: string | null | undefined,
  relationshipStatus?: string | null | undefined
): LeadTemperature {
  return calculateTemperature({
    completion_percentage: completionPercentage,
    vehicle_protection_experience: vehicleProtectionExperience,
    relationship_status: relationshipStatus,
    has_vehicle: hasVehicle,
    has_driver_license: hasCNH,
    sales_experience: salesExperience,
  });
}

export function calculateLeadScore(answers: QuizAnswers): LeadScore {
  const breakdown: ScoreBreakdown = {
    age: 0,
    maritalStatus: 0,
    vehicle: 0,
    cnh: 0,
    employment: 0,
    sales: 0,
    vehicleProtection: 0,
    currentIncome: 0,
    desiredIncome: 0,
  };

  // P3 - Idade (max 20 pts)
  if (answers.age) {
    if (answers.age >= 18 && answers.age <= 25) breakdown.age = 15;
    else if (answers.age >= 26 && answers.age <= 35) breakdown.age = 20;
    else if (answers.age >= 36 && answers.age <= 45) breakdown.age = 15;
    else if (answers.age >= 46) breakdown.age = 10;
  }

  // P4 - Estado civil (max 15 pts)
  if (answers.maritalStatus) {
    const status = answers.maritalStatus.toLowerCase();
    if (status.includes('solteiro')) breakdown.maritalStatus = 10;
    else if (status.includes('namorando')) breakdown.maritalStatus = 10;
    else if (status.includes('casado')) breakdown.maritalStatus = 15;
    else if (status.includes('divorciado')) breakdown.maritalStatus = 12;
  }

  // P6 - Possui veículo (max 25 pts)
  if (answers.hasVehicle) {
    const vehicle = answers.hasVehicle.toLowerCase();
    if (vehicle.includes('ambos')) breakdown.vehicle = 25;
    else if (vehicle.includes('carro')) breakdown.vehicle = 20;
    else if (vehicle.includes('moto')) breakdown.vehicle = 15;
    // "não tenho" = 0 pts
  }

  // P7 - Possui CNH (max 15 pts)
  if (answers.hasCNH) {
    const cnh = answers.hasCNH.toLowerCase();
    if (cnh.includes('sim')) breakdown.cnh = 15;
    // "não possuo" = 0 pts
  }

  // P8 - Situação profissional (max 20 pts)
  if (answers.employmentStatus) {
    const employment = answers.employmentStatus.toLowerCase();
    if (employment.includes('negócio próprio')) breakdown.employment = 20;
    else if (employment.includes('autônomo')) breakdown.employment = 15;
    else if (employment.includes('clt') || employment.includes('registrado')) breakdown.employment = 10;
    else if (employment.includes('desempregado')) breakdown.employment = 5;
    else if (employment.includes('estudante')) breakdown.employment = 5;
  }

  // P10 - Experiência com vendas (max 20 pts)
  if (answers.salesExperience) {
    const sales = answers.salesExperience.toLowerCase();
    if (sales.includes('já trabalho')) breakdown.sales = 20;
    else if (sales.includes('já trabalhei')) breakdown.sales = 15;
    else if (sales.includes('interesse')) breakdown.sales = 10;
    else if (sales.includes('nunca')) breakdown.sales = 5;
  }

  // P11 - Trabalhou com proteção veicular (max 20 pts)
  if (answers.vehicleProtectionExperience) {
    const protection = answers.vehicleProtectionExperience.toLowerCase();
    if (protection.includes('sim')) breakdown.vehicleProtection = 20;
    else breakdown.vehicleProtection = 5;
  }

  // P12 - Ganhos atuais (max 20 pts)
  if (answers.currentIncome) {
    const income = answers.currentIncome.toLowerCase();
    if (income.includes('acima') && income.includes('5.000')) breakdown.currentIncome = 20;
    else if (income.includes('3.000') && income.includes('5.000')) breakdown.currentIncome = 15;
    else if (income.includes('1.500') && income.includes('3.000')) breakdown.currentIncome = 10;
    else if (income.includes('1.500')) breakdown.currentIncome = 5;
  }

  // P13 - Renda desejada (max 25 pts)
  if (answers.desiredIncome) {
    const desired = answers.desiredIncome.toLowerCase();
    if (desired.includes('melhor renda')) breakdown.desiredIncome = 25;
    else if (desired.includes('acima') && desired.includes('12.000')) breakdown.desiredIncome = 20;
    else if (desired.includes('8.000') && desired.includes('12.000')) breakdown.desiredIncome = 20;
    else if (desired.includes('5.000') && desired.includes('8.000')) breakdown.desiredIncome = 15;
    else if (desired.includes('3.000') && desired.includes('5.000')) breakdown.desiredIncome = 10;
  }

  // Calcular total
  const total_score = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const percentage = Math.round((total_score / MAX_LEAD_SCORE) * 100);

  // Usar a nova lógica de temperatura
  const temperature = calculateTemperature({
    completion_percentage: 100, // Se está calculando score, assumimos que completou
    vehicle_protection_experience: answers.vehicleProtectionExperience,
    relationship_status: answers.maritalStatus,
    has_vehicle: answers.hasVehicle,
    has_driver_license: answers.hasCNH,
    sales_experience: answers.salesExperience,
  });

  return {
    total_score,
    max_score: MAX_LEAD_SCORE,
    percentage,
    temperature,
    breakdown,
  };
}

// Helper para converter respostas do quiz para o formato do scoring
export function mapQuizDataToScoring(quizData: Record<number, string>): QuizAnswers {
  return {
    age: quizData[3] ? parseInt(quizData[3]) : undefined,
    maritalStatus: quizData[4],
    hasVehicle: quizData[6],
    hasCNH: quizData[7],
    employmentStatus: quizData[8],
    salesExperience: quizData[10],
    vehicleProtectionExperience: quizData[11],
    currentIncome: quizData[12],
    desiredIncome: quizData[13],
  };
}

/**
 * Calcula temperatura diretamente dos dados do banco de dados
 * Útil para recalcular temperatura de leads existentes
 */
export function calculateTemperatureFromDbData(
  lead: {
    completion_percentage: number;
    vehicle_protection_experience?: string | null;
    relationship_status?: string | null;
    has_vehicle?: string | null;
    has_driver_license?: string | null;
    sales_experience?: string | null;
  }
): LeadTemperature {
  return calculateTemperature({
    completion_percentage: lead.completion_percentage,
    vehicle_protection_experience: lead.vehicle_protection_experience,
    relationship_status: lead.relationship_status,
    has_vehicle: lead.has_vehicle,
    has_driver_license: lead.has_driver_license,
    sales_experience: lead.sales_experience,
  });
}
