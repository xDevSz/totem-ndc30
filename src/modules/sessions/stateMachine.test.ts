// src/modules/sessions/stateMachine.test.ts
import { describe, it, expect } from 'vitest';
import { transition,type SessionState,type SessionEvent } from './stateMachine.js';

describe('S2.2: Máquina de Estados da Sessão', () => {
  it('Caminho feliz: do pagamento até a conclusão', () => {
    let state: SessionState = 'AWAITING_PAYMENT';
    
    state = transition(state, 'PAYMENT_CONFIRMED');
    expect(state).toBe('STARTING');
    
    state = transition(state, 'REMOTE_START_ACCEPTED');
    expect(state).toBe('STARTING');
    
    state = transition(state, 'TRANSACTION_STARTED');
    expect(state).toBe('CHARGING');
    
    state = transition(state, 'LIMIT_REACHED');
    expect(state).toBe('STOPPING');
    
    state = transition(state, 'TRANSACTION_STOPPED');
    expect(state).toBe('COMPLETED');
  });

  it('Recusa do carregador: estorno total (RemoteStart recusado)', () => {
    let state: SessionState = 'AWAITING_PAYMENT';
    state = transition(state, 'PAYMENT_CONFIRMED');
    
    // Carregador recusa o comando
    state = transition(state, 'REMOTE_START_REJECTED');
    expect(state).toBe('REFUNDING');
  });

  it('Queda de conexão no meio da carga fecha a sessão corretamente', () => {
    let state: SessionState = 'CHARGING';
    state = transition(state, 'CONNECTION_LOST');
    expect(state).toBe('COMPLETED');
  });

  it('Bloqueia transições inválidas (gera erro)', () => {
    const state: SessionState = 'AWAITING_PAYMENT';
    
    // Tentar parar uma carga sem nem ter pago
    expect(() => transition(state, 'LIMIT_REACHED')).toThrow(
      'Transição inválida: Não é possível ir de AWAITING_PAYMENT usando o evento LIMIT_REACHED.'
    );
  });
});