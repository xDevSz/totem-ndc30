// src/modules/payments/fakeGateway.test.ts
import { describe, it, expect } from 'vitest';
import { FakePaymentGateway } from './fakeGateway.js';
import { toCents } from '../sessions/calculator.js';

describe('S2.6: Gateway Falso', () => {
  it('Cria uma cobrança e o cliente paga (Botão de Pagar)', async () => {
    const gateway = new FakePaymentGateway();
    
    // Sistema cria cobrança
    await gateway.createCharge('sess-1', toCents(5000));
    let charge = await gateway.getCharge('sess-1');
    expect(charge?.status).toBe('PENDING');

    // Teste aperta o botão de pagar
    await gateway.simulatePayment('sess-1');
    charge = await gateway.getCharge('sess-1');
    expect(charge?.status).toBe('PAID');
  });

  it('Faz uma devolução com sucesso', async () => {
    const gateway = new FakePaymentGateway();
    await gateway.createCharge('sess-2', toCents(3000));
    await gateway.simulatePayment('sess-2');

    // Sistema pede devolução
    const success = await gateway.refund('sess-2', toCents(1000));
    expect(success).toBe(true);
    
    const charge = await gateway.getCharge('sess-2');
    expect(charge?.status).toBe('REFUNDED');
  });

  it('Simula falha na devolução (Botão de Falha)', async () => {
    const gateway = new FakePaymentGateway();
    await gateway.createCharge('sess-3', toCents(3000));
    await gateway.simulatePayment('sess-3');

    // Teste aperta o botão de falha (simulando API fora do ar)
    gateway.simulateRefundFailure = true;

    // Sistema tenta devolver e falha
    const success = await gateway.refund('sess-3', toCents(1000));
    expect(success).toBe(false);
  });
});