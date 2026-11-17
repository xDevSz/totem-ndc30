// src/modules/sessions/stateMachine.ts

export type SessionState = 
  | 'AWAITING_PAYMENT' 
  | 'STARTING' 
  | 'CHARGING' 
  | 'STOPPING' 
  | 'COMPLETED' 
  | 'REFUNDING'
  | 'REFUND_FAILED'
  | 'FAILED';

export type SessionEvent = 
  | 'PAYMENT_CONFIRMED'
  | 'REMOTE_START_ACCEPTED'
  | 'REMOTE_START_REJECTED'
  | 'TRANSACTION_STARTED'
  | 'LIMIT_REACHED'
  | 'REMOTE_STOP_ACCEPTED'
  | 'TRANSACTION_STOPPED'
  | 'REFUND_SUCCESS'
  | 'REFUND_ERROR'
  | 'CONNECTION_LOST';

// Tabela de transições permitidas (S2.2)
const transitions: Record<SessionState, Partial<Record<SessionEvent, SessionState>>> = {
  AWAITING_PAYMENT: {
    PAYMENT_CONFIRMED: 'STARTING',
  },
  STARTING: {
    REMOTE_START_ACCEPTED: 'STARTING', // Aguardando o carregador confirmar que iniciou
    TRANSACTION_STARTED: 'CHARGING',
    REMOTE_START_REJECTED: 'REFUNDING', // Se recusar, estorna o valor total
    CONNECTION_LOST: 'REFUNDING',
  },
  CHARGING: {
    LIMIT_REACHED: 'STOPPING',
    TRANSACTION_STOPPED: 'COMPLETED', // Pode ser parado pelo carro ou pelo cliente
    CONNECTION_LOST: 'COMPLETED',     // Se cair no meio, fecha com a energia medida até ali
  },
  STOPPING: {
    REMOTE_STOP_ACCEPTED: 'STOPPING',
    TRANSACTION_STOPPED: 'COMPLETED',
  },
  COMPLETED: {
    REFUND_SUCCESS: 'COMPLETED', // Devolução finalizada
    REFUND_ERROR: 'REFUND_FAILED',
  },
  REFUNDING: {
    REFUND_SUCCESS: 'FAILED', // Falhou a sessão, mas o dinheiro foi devolvido
    REFUND_ERROR: 'REFUND_FAILED',
  },
  REFUND_FAILED: {}, // Estado terminal que exige ação manual
  FAILED: {},        // Estado terminal
};

/**
 * Processa a transição de estado.
 * Uma transição inválida gera erro (S2.2).
 */
export function transition(currentState: SessionState, event: SessionEvent): SessionState {
  const nextState = transitions[currentState]?.[event];
  
  if (!nextState) {
    throw new Error(`Transição inválida: Não é possível ir de ${currentState} usando o evento ${event}.`);
  }
  
  return nextState;
}