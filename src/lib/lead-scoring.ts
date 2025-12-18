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

// Nova função para calcular temperatura baseado nos critérios do usuário
export function calculateTemperature(
  completionPercentage: number,
  hasVehicle: string | null | undefined,
  hasCNH: string | null | undefined,
  salesExperience: string | null | undefined
): LeadTemperature {
  // Frio: Não completou o quiz
  if (completionPercentage < 100) {
    return 'cold';
  }
  
  // Verificar critérios para quente
  const temVeiculo = hasVehicle?.toLowerCase().includes('carro') || 
                     hasVehicle?.toLowerCase().includes('moto') || 
                     hasVehicle?.toLowerCase().includes('ambos');
  
  const temCNH = hasCNH?.toLowerCase().includes('sim');
  
  const temExpVendas = salesExperience?.toLowerCase().includes('já trabalho') ||
                       salesExperience?.toLowerCase().includes('já trabalhei');
  
  // Quente: Completou + tem veículo + tem CNH + experiência vendas
  if (temVeiculo && temCNH && temExpVendas) {
    return 'hot';
  }
  
  // Morno: Completou mas não atende todos os critérios
  return 'warm';
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

  // Determinar temperatura baseado na porcentagem
  let temperature: LeadTemperature = 'cold';
  if (percentage >= 75) temperature = 'hot';      // 140+ pts
  else if (percentage >= 50) temperature = 'warm'; // 90-139 pts

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
