// src/modules/sessions/calculator.ts

// Usamos "Branded Types" para o TypeScript barrar se tentarmos passar Wh onde se espera Centavos
export type Cents = number & { readonly __brand: unique symbol };
export type WattHour = number & { readonly __brand: unique symbol };



// Funções utilitárias para converter números normais nos nossos tipos seguros
export const toCents = (value: number): Cents => Math.floor(value) as Cents;
export const toWattHour = (value: number): WattHour => Math.floor(value) as WattHour;



/**
 * Calcula o limite de energia arredondando para baixo (S2.1).
 * Exemplo do plano: R$ 60 (6000 centavos) a R$ 1,99/kWh (199 centavos) = 30150 Wh.
 */
export function calculateEnergyLimit(paidInCents: Cents, tariffCentsPerKwh: Cents): WattHour {
  if (paidInCents <= 0 || tariffCentsPerKwh <= 0) return toWattHour(0);
  

  
  // Regra de três: (Valor Pago * 1000 Wh) / Tarifa por kWh
  const limit = Math.floor((paidInCents * 1000) / tariffCentsPerKwh);
  
  return toWattHour(limit);
}

/**
 * Calcula a devolução com base no consumo real (S2.1).
 */
export function calculateRefund(paidInCents: Cents, consumedWh: WattHour, tariffCentsPerKwh: Cents): Cents {
  if (consumedWh <= 0) return paidInCents;

  // O custo do que foi consumido. Arredondamos o custo para CIMA 
  // para a empresa nunca perder frações de centavo na devolução.
  const cost = Math.ceil((consumedWh * tariffCentsPerKwh) / 1000);
  const refund = paidInCents - cost;
  
  return toCents(Math.max(0, refund));
}