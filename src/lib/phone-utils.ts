/**
 * Normaliza um número de telefone para o formato brasileiro padrão (55 + DDD + número)
 */
export function normalizePhone(phone: string): string {
  // Remove tudo que não é número
  const cleaned = phone.replace(/\D/g, '');
  
  // Se já tem código do país (55) e tem 12+ dígitos, retorna como está
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned;
  }
  
  // Se tem 11 dígitos (DDD + número com 9), adiciona 55
  if (cleaned.length === 11) {
    return `55${cleaned}`;
  }
  
  // Se tem 10 dígitos (DDD + número sem 9), adiciona 55
  if (cleaned.length === 10) {
    return `55${cleaned}`;
  }
  
  // Retorna como está se não se encaixa nos padrões
  return cleaned;
}

/**
 * Gera variantes do telefone brasileiro (com e sem o 9 adicional após DDD)
 * Útil para matching de leads e conversas
 */
export function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const variants: string[] = [normalized];
  
  // Formato esperado: 55 + DDD(2) + número(8 ou 9)
  if (normalized.startsWith('55') && normalized.length >= 12) {
    const ddd = normalized.slice(2, 4);
    const rest = normalized.slice(4);
    
    // Se tem 9 dígitos no número (total 13), criar variante sem o 9
    if (rest.length === 9 && rest.startsWith('9')) {
      const withoutNine = `55${ddd}${rest.slice(1)}`;
      variants.push(withoutNine);
    }
    // Se tem 8 dígitos no número (total 12), criar variante com o 9
    else if (rest.length === 8) {
      const withNine = `55${ddd}9${rest}`;
      variants.push(withNine);
    }
  }
  
  return variants;
}

/**
 * Formata um número de telefone para exibição amigável
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  
  // Formato: +55 (33) 98467-5657
  if (normalized.length >= 12) {
    const country = normalized.slice(0, 2);
    const ddd = normalized.slice(2, 4);
    const part1 = normalized.slice(4, 9);
    const part2 = normalized.slice(9);
    return `+${country} (${ddd}) ${part1}-${part2}`;
  }
  
  if (normalized.length === 11) {
    const ddd = normalized.slice(0, 2);
    const part1 = normalized.slice(2, 7);
    const part2 = normalized.slice(7);
    return `(${ddd}) ${part1}-${part2}`;
  }
  
  return phone;
}

/**
 * Compara dois números de telefone considerando variantes (com/sem 9)
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const variants1 = getPhoneVariants(phone1);
  const variants2 = getPhoneVariants(phone2);
  
  // Verifica se alguma variante de phone1 coincide com alguma variante de phone2
  return variants1.some(v1 => variants2.includes(v1));
}
