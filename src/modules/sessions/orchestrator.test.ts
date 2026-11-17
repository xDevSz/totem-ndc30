// src/modules/sessions/orchestrator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SessionOrchestrator, type ChargerClient, type PaymentGateway } from './orchestrator.js';
import { toCents, toWattHour } from './calculator.js';

describe('S2.3: Orquestrador de Sessão', () => {
  // Criamos "Dublês" (Mocks) para o carregador e para o gateway
  const mockCharger = (): ChargerClient => ({
    remoteStart: vi.fn().mockResolvedValue(true),
    remoteStop: vi.fn().mockResolvedValue(true),
  });

  const mockGateway = (): PaymentGateway => ({
    refund: vi.fn().mockResolvedValue(true),
  });

  it('Cenário 1: Caminho feliz. Paga, carrega, atinge o limite, para e devolve a sobra', async () => {
    const charger = mockCharger();
    const gateway = mockGateway();
    
    const orchestrator = new SessionOrchestrator('sess-1', 1, toCents(199), charger, gateway);
    
    // 1. Cliente pagou R$ 60
    await orchestrator.onPaymentConfirmed(toCents(6000));
    // Correção: O estado correto aqui é 'STARTING'
    expect(orchestrator.state).toBe('STARTING'); 
    expect(charger.remoteStart).toHaveBeenCalledWith(1);
    expect(orchestrator.limitWh).toBe(30150);

    // 2. Carro começou
    orchestrator.onTransactionStarted();
    expect(orchestrator.state).toBe('CHARGING');

    // 3. Mediu 10.000 Wh (Abaixo do limite, não deve parar)
    await orchestrator.onMeterValues(toWattHour(10000));
    expect(charger.remoteStop).not.toHaveBeenCalled();

    // 4. Atingiu o limite de 30.150 Wh (Deve enviar parar)
    await orchestrator.onMeterValues(toWattHour(30150));
    // Correção: O estado correto aqui é 'STOPPING'
    expect(orchestrator.state).toBe('STOPPING'); 
    expect(charger.remoteStop).toHaveBeenCalledWith(1);

    // 5. Parou. Estornar sobra (R$ 60 - custo de 30.150 Wh)
    await orchestrator.onTransactionStopped(toWattHour(30150));
    // Como atingiu o teto exato, o arredondamento dá custo 6000 centavos. Sobra = 0.
    // Portanto, o refund NÃO deve ser chamado.
    expect(gateway.refund).not.toHaveBeenCalled(); 
    expect(orchestrator.state).toBe('COMPLETED');
  });


it('Cenário 3: RemoteStart recusado pelo carregador estorna total', async () => {
    const charger = mockCharger();
    // Forçamos o carregador a recusar
    charger.remoteStart = vi.fn().mockResolvedValue(false);
    
    const gateway = mockGateway();
    
    const orchestrator = new SessionOrchestrator('sess-2', 1, toCents(199), charger, gateway);
    
    // Pagou R$ 30, mas carregador recusou
    await orchestrator.onPaymentConfirmed(toCents(3000));
    
    // Deve ter pedido devolução total
    expect(gateway.refund).toHaveBeenCalledWith('sess-2', 3000);
    // Correção: A sessão não completa, ela falha (FAILED) e o estorno total é feito
    expect(orchestrator.state).toBe('FAILED'); 
  });


  // O Cenário 5 deve ficar AQUI DENTRO, antes de fechar a chave do describe
  it('Cenário 5: Conexão cai (ou cliente para) no meio da carga, devolve a sobra corretamente', async () => {
    const charger = mockCharger();
    const gateway = mockGateway();
    
    const orchestrator = new SessionOrchestrator('sess-4', 1, toCents(199), charger, gateway);
    
    await orchestrator.onPaymentConfirmed(toCents(6000));
    orchestrator.onTransactionStarted();
    
    // Parou prematuramente com apenas 10.000 Wh consumidos
    await orchestrator.onTransactionStopped(toWattHour(10000));
    
    // Custo de 10.000 Wh a R$ 1,99 é 1990 centavos. Sobra é 6000 - 1990 = 4010 centavos
    expect(gateway.refund).toHaveBeenCalledWith('sess-4', 4010);
    expect(orchestrator.state).toBe('COMPLETED'); 
  });


  it('Cenário 6: Aviso de pagamento duplicado processa apenas uma partida', async () => {
    const charger = mockCharger();
    const gateway = mockGateway();
    const orchestrator = new SessionOrchestrator('sess-5', 1, toCents(199), charger, gateway);

    // Primeiro aviso chega
    await orchestrator.onPaymentConfirmed(toCents(5000));
    
    // Gateway tem um atraso na rede e manda o mesmo aviso de pagamento de novo
    await orchestrator.onPaymentConfirmed(toCents(5000));

    // O carregador só pode ter recebido o comando de iniciar UMA vez
    expect(charger.remoteStart).toHaveBeenCalledTimes(1);
    // E o estado avança normalmente, sem quebrar
    expect(orchestrator.state).toBe('STARTING');
  });


}); 