// src/modules/sessions/orchestrator.ts
import { transition, type SessionState } from './stateMachine.js';
import { calculateEnergyLimit, calculateRefund, toWattHour, type Cents, type WattHour } from './calculator.js';

// Interfaces que representam o mundo externo (S2.6 e OCPP)
export interface ChargerClient {
  remoteStart(connectorId: number): Promise<boolean>;
  remoteStop(connectorId: number): Promise<boolean>;
}

export interface PaymentGateway {
  refund(sessionId: string, amountCents: Cents): Promise<boolean>;
}

export class SessionOrchestrator {
  public state: SessionState = 'AWAITING_PAYMENT';
  public limitWh: WattHour = toWattHour(0);
  public paidAmount: Cents = 0 as Cents;

  constructor(
    public readonly sessionId: string,
    public readonly connectorId: number,
    public readonly tariffCents: Cents,
    private charger: ChargerClient,
    private gateway: PaymentGateway
  ) {}

  // 1. Cliente pagou o Pix
  async onPaymentConfirmed(paidInCents: Cents): Promise<void> {
    
    // S2.4: Se a sessão já passou de AWAITING_PAYMENT, é um evento duplicado. Ignora.
    if (this.state !== 'AWAITING_PAYMENT') {
      return; 
    }

    this.state = transition(this.state, 'PAYMENT_CONFIRMED');
    this.paidAmount = paidInCents;
    this.limitWh = calculateEnergyLimit(this.paidAmount, this.tariffCents);

    // Envia o comando para o totem ligar
    const accepted = await this.charger.remoteStart(this.connectorId);
    
    if (accepted) {
      this.state = transition(this.state, 'REMOTE_START_ACCEPTED');
      // Obs: Aqui entraria o timer aguardando o TRANSACTION_STARTED (S2.3)
    } else {
      // Carregador recusou, estorno total
      this.state = transition(this.state, 'REMOTE_START_REJECTED');
      await this.processRefund(this.paidAmount);
    }
  }

  // 2. O carro começou a puxar energia
  onTransactionStarted(): void {
    this.state = transition(this.state, 'TRANSACTION_STARTED');
  }

  // 3. Totem envia as leituras de energia de tempos em tempos
  async onMeterValues(consumedWh: WattHour): Promise<void> {
    if (this.state !== 'CHARGING') return;

    if (consumedWh >= this.limitWh) {
      this.state = transition(this.state, 'LIMIT_REACHED');
      await this.charger.remoteStop(this.connectorId);
      this.state = transition(this.state, 'REMOTE_STOP_ACCEPTED');
    }
  }

// 4. A sessão acabou (seja pelo limite, pelo cliente ou pelo carro)
  async onTransactionStopped(finalConsumedWh: WattHour): Promise<void> {
    // Dispara o evento de parada. Aqui o estado já vira 'COMPLETED'
    this.state = transition(this.state, 'TRANSACTION_STOPPED');
    
    const refundAmount = calculateRefund(this.paidAmount, finalConsumedWh, this.tariffCents);
    
    if (refundAmount > 0) {
      await this.processRefund(refundAmount);
    }
    // Se a sobra for zero, não fazemos nada porque o estado já é 'COMPLETED'
  }

  // Função auxiliar para lidar com devoluções limpa e usando os eventos corretos
  private async processRefund(amount: Cents): Promise<void> {
    const success = await this.gateway.refund(this.sessionId, amount);
    
    if (success) {
      // Usa os eventos reais da nossa stateMachine!
      this.state = transition(this.state, 'REFUND_SUCCESS');
    } else {
      this.state = transition(this.state, 'REFUND_ERROR');
    }
  }
}