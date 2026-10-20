/*
 * regras.js — números que definem a partida. Mudou o balanceamento? É aqui.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  OG.regras = Object.freeze({
    VERSAO_ESTADO: 1,

    TOTAL_RODADAS: 4,
    EVENTOS_POR_PARTIDA: 4,
    LIMITE_EM_ANDAMENTO: 2,

    CAIXA_INICIAL: 500,
    // Opção "Caixa apertado" (Configurações): com R$ 500 o caixa nunca trava a partida
    // nas simulações (menor caixa ~R$ 250). Com R$ 200 o dinheiro vira decisão de verdade.
    CAIXA_APERTADO: 200,
    PRESTIGIO_INICIAL: 20,
    TRADICAO_INICIAL: 20,

    // Especialista na equipe: desconto no custo do projeto (por pessoa).
    DESCONTO_ESPECIALISTA: 10,

    // Trabalhador temporário (evento "Patrício Ajudou"): esta rodada e a próxima.
    DURACAO_TEMPORARIO: 2,

    // Despesa obrigatória sem caixa: o que faltar vira desgaste de prestígio.
    REAIS_POR_PONTO_DE_DESGASTE: 10,

    // Pontuação final.
    REAIS_POR_PONTO: 10,
    PONTOS_POR_PROJETO: 5,

    COLUNAS: Object.freeze([
      Object.freeze({ id: 'backlog', nome: 'Backlog', dica: 'Projetos da missão ainda não escolhidos.' }),
      Object.freeze({ id: 'afazer', nome: 'A Fazer', dica: 'Escolhidos e prontos para começar.' }),
      Object.freeze({ id: 'andamento', nome: 'Em Andamento', dica: 'Sendo executados. Máximo de 2.', limite: 2 }),
      Object.freeze({ id: 'revisao', nome: 'Revisão', dica: 'Execução terminada. Um coordenador confere.' }),
      Object.freeze({ id: 'concluido', nome: 'Concluído', dica: 'Pronto! Retorno e pontos creditados.' }),
    ]),

    /*
     * Classificações, em % da META da missão (aproveitamento).
     *
     * Por que não pontos absolutos? Com a fórmula de pontuação, só o caixa e os
     * recursos iniciais já valem 90 pontos: com os limites originais em pontos
     * (100/80/60/40), quem não fizesse NADA terminaria como "GRÊMIO DESTAQUE".
     * Além disso, cada missão tem um potencial diferente (a Farroupilha rende
     * tradição, a Junina não). Então os mesmos números 100/80/60/40 passaram a ser
     * porcentagem de APROVEITAMENTO:
     *   pontos conquistados na partida ÷ pontos que o melhor plano possível conquistaria
     * ("conquistados" = pontuação final − pontos iniciais; o melhor plano é calculado
     * a partir dos próprios cards em pontuacao.js, sem eventos).
     */
    CLASSIFICACOES: Object.freeze([
      Object.freeze({ minimo: 100, nome: 'GRÊMIO LENDÁRIO' }),
      Object.freeze({ minimo: 80, nome: 'GRÊMIO DESTAQUE' }),
      Object.freeze({ minimo: 60, nome: 'GRÊMIO APROVADO' }),
      Object.freeze({ minimo: 40, nome: 'GRÊMIO SOBREVIVEU' }),
      Object.freeze({ minimo: -Infinity, nome: 'A DIREÇÃO QUER CONVERSAR' }),
    ]),
  });
})(globalThis);
