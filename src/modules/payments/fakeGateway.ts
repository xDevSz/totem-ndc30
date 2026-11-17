// src/modules/payments/fakeGateway.ts
import type { Cents } from '../sessions/calculator.js';
import type { PaymentGateway } from '../sessions/orchestrator.js';

export type ChargeStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'REFUNDED';

export interface FakeCharge {
  id: string;
  amount: Cents;
  status: ChargeStatus;
}

export class FakePaymentGateway implements PaymentGateway {
  // Nosso "banco de dados" em memória para os testes
  public charges: Map<string, FakeCharge> = new Map();
  
  // Variável para simular uma falha na rede na hora da devolução
  public simulateRefundFailure = false;

  // 1. O sistema cria a cobrança
  async createCharge(sessionId: string, amount: Cents): Promise<FakeCharge> {
    const charge: FakeCharge = {
      id: sessionId,
      amount,
      status: 'PENDING',
    };
    this.charges.set(sessionId, charge);
    return charge;
  }

  // 2. O sistema consulta como está a cobrança
  async getCharge(sessionId: string): Promise<FakeCharge | undefined> {
    return this.charges.get(sessionId);
  }

  // 3. O sistema pede a devolução (Implementa a interface do Orquestrador)
  async refund(sessionId: string, amountCents: Cents): Promise<boolean> {
    if (this.simulateRefundFailure) {
      return false; // S2.6: Botão de falhar a devolução
    }

    const charge = this.charges.get(sessionId);
    if (!charge || charge.status !== 'PAID') {
      return false;
    }

    charge.status = 'REFUNDED';
    return true;
  }

  // --- BOTÕES SECRETOS PARA OS TESTES (S2.6) ---

  // Botão: Cliente pagou
  async simulatePayment(sessionId: string): Promise<void> {
    const charge = this.charges.get(sessionId);
    if (charge) {
      charge.status = 'PAID';
    }
  }

  // Botão: O tempo do Pix acabou
  async simulateExpiration(sessionId: string): Promise<void> {
    const charge = this.charges.get(sessionId);
    if (charge && charge.status === 'PENDING') {
      charge.status = 'EXPIRED';
    }
  }
}