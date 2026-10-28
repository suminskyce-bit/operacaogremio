/*
 * regras.js — números que definem a partida. Mudou o balanceamento? É aqui.
 * Depois de mexer, rode `npm test` e `npm run simular`.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function congelarLista(lista) {
    return Object.freeze(lista.map(function (x) { return Object.freeze(x); }));
  }

  OG.regras = Object.freeze({
    VERSAO_ESTADO: 2,

    // ---------------- Duração ----------------
    // missoes: quantas missões entram na agenda (a escolhida + sorteadas).
    DURACOES: congelarLista([
      { rodadas: 4, nome: 'Rápida', tempo: '≈ 20 min', missoes: 1 },
      { rodadas: 8, nome: 'Média', tempo: '≈ 40 min', missoes: 2 },
      { rodadas: 10, nome: 'Longa', tempo: '≈ 50 min', missoes: 3 },
      { rodadas: 26, nome: 'Ano letivo', tempo: '≈ 2 h', missoes: 10 },
    ]),
    DURACAO_PADRAO: 4,

    // Cada missão fica aberta por 4 rodadas: os 6 projetos chegam na abertura e o prazo
    // de todos é a "data" da missão (abertura + 3).
    JANELA_MISSAO: 4,

    // Pedidos avulsos que chegam ao Backlog no começo de cada rodada (menos a última).
    PEDIDOS_POR_RODADA: 2,

    // ---------------- Coordenadores ----------------
    // Cada coordenador é responsável por até 2 cards em A Fazer e toca 1 por vez.
    FILA_POR_COORDENADOR: 2,
    // Coordenador tocando projeto fora da própria área: +1 rodada de execução.
    TEMPO_FORA_DA_AREA: 1,

    // ---------------- Força de trabalho ----------------
    // Força necessária de um projeto = trabalhadores do card + 3.
    // O coordenador responsável soma 1; voluntário soma 1; voluntário especialista soma 2.
    FORCA_EXTRA: 3,
    FORCA_COORDENADOR: 1,
    FORCA_VOLUNTARIO: 1,
    FORCA_ESPECIALISTA: 2,

    // ---------------- Eventos ----------------
    // Com até 5 projetos ao mesmo tempo, "só um" travava a rodada inteira.
    LIMITE_INICIOS_CHIMARRAO: 2,
    LIMITE_MOVIMENTOS_PROVAS: 2,

    // ---------------- Dinheiro e pontos ----------------
    CAIXA_INICIAL: 500,
    // Opção "Caixa apertado" (Configurações).
    CAIXA_APERTADO: 200,
    PRESTIGIO_INICIAL: 20,
    TRADICAO_INICIAL: 20,

    // Voluntário especialista na equipe: desconto no custo do projeto (por pessoa).
    DESCONTO_ESPECIALISTA: 10,

    // Trabalhador temporário (evento "Patrício Ajudou"): esta rodada e a próxima.
    DURACAO_TEMPORARIO: 2,

    // Despesa obrigatória sem caixa: o que faltar vira desgaste de prestígio.
    REAIS_POR_PONTO_DE_DESGASTE: 10,

    // Projeto revisado depois do prazo: só metade do retorno, sem prestígio nem tradição.
    FRACAO_RETORNO_ATRASADO: 0.5,

    // Pontuação final.
    REAIS_POR_PONTO: 10,
    PONTOS_POR_PROJETO: 5,

    COLUNAS: congelarLista([
      { id: 'backlog', nome: 'Backlog', dica: 'Projetos e pedidos esperando alguém assumir.' },
      { id: 'afazer', nome: 'A Fazer', dica: 'Já têm coordenador responsável. Até 2 por coordenador.' },
      { id: 'andamento', nome: 'Em Andamento', dica: 'Sendo executados. Cada coordenador toca 1 por vez.' },
      { id: 'revisao', nome: 'Revisão', dica: 'Execução terminada. Outro coordenador confere.' },
      { id: 'concluido', nome: 'Concluído', dica: 'Pronto! Retorno e pontos creditados.' },
    ]),

    /*
     * Classificação pelo APROVEITAMENTO:
     *   pontos conquistados na partida ÷ pontos que o planejador do jogo conquistaria
     *   na MESMA partida (mesma agenda e mesmos pedidos), sem imprevistos.
     * "Conquistados" = pontuação final − pontos com que o Grêmio começou.
     * Faixas calibradas na simulação (npm run simular): quem faz o fluxo certo mas põe
     * coordenador e equipe ao acaso fica perto de 55–65% (SOBREVIVEU); quem escolhe bem
     * o coordenador de cada card passa de 85%.
     */
    CLASSIFICACOES: congelarLista([
      { minimo: 100, nome: 'GRÊMIO LENDÁRIO' },
      { minimo: 85, nome: 'GRÊMIO DESTAQUE' },
      { minimo: 70, nome: 'GRÊMIO APROVADO' },
      { minimo: 50, nome: 'GRÊMIO SOBREVIVEU' },
      { minimo: -Infinity, nome: 'A DIREÇÃO QUER CONVERSAR' },
    ]),
  });

  /** Funções de apoio (OG.regras é congelado, então ficam aqui). */
  OG.regrasUtil = Object.freeze({
    /** Dados da duração (4, 8, 10 ou 26 rodadas), ou null. */
    duracao: function (rodadas) {
      return OG.regras.DURACOES.find(function (d) { return d.rodadas === rodadas; }) || null;
    },
  });
})(globalThis);
