// src/modules/sessions/calculator.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateEnergyLimit, calculateRefund, toCents, toWattHour } from './calculator.js';

describe('S2.1: Dinheiro e Energia', () => {
  it('calcula o exato limite do exemplo do plano: R$ 60 a R$ 1,99/kWh dá 30.150 Wh', () => {
    const paid = toCents(6000);
    const tariff = toCents(199);
    
    const limit = calculateEnergyLimit(paid, tariff);
    
    expect(limit).toBe(30150);
  });

  it('nunca dá mais energia do que o valor cobre (Property Test)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }), // Pagamento entre 1 centavo e R$ 10.000
        fc.integer({ min: 50, max: 5000 }),   // Tarifa entre R$ 0,50 e R$ 50,00
        (paid, tariff) => {
          const paidCents = toCents(paid);
          const tariffCents = toCents(tariff);
          
          const limitWh = calculateEnergyLimit(paidCents, tariffCents);
          
          // O custo teórico da energia liberada não pode ser maior que o que o cliente pagou
          const maxCostForLimit = (limitWh * tariffCents) / 1000;
          expect(maxCostForLimit).toBeLessThanOrEqual(paidCents);
        }
      )
    );
  });

  it('nunca devolve um valor negativo e nunca devolve mais do que foi pago (Property Test)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 1000000 }), 
        fc.integer({ min: 0, max: 100000 }),     
        fc.integer({ min: 100, max: 500 }),      
        (paid, consumed, tariff) => {
          const refund = calculateRefund(toCents(paid), toWattHour(consumed), toCents(tariff));
          
          expect(refund).toBeGreaterThanOrEqual(0);
          expect(refund).toBeLessThanOrEqual(paid);
        }
      )
    );
  });
});