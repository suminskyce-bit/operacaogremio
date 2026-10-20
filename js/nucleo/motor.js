/*
 * motor.js — ponto único de entrada das regras.
 *
 *   const estado = OG.motor.criarPartida('farroupilha', semente);
 *   const r = OG.motor.aplicar(estado, { tipo: 'PLANEJAR', cartaId: 'mateada' });
 *   if (r.ok) estado = r.estado; else mostrar(r.erro);
 *
 * `aplicar` nunca altera o estado recebido: trabalha numa cópia e só devolve a cópia
 * se a ação inteira deu certo. Ação inválida = estado intacto + mensagem explicando.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  /**
   * opcoes.caixaApertado: true começa com regras.CAIXA_APERTADO em vez de CAIXA_INICIAL.
   */
  function criarPartida(missaoId, semente, opcoes) {
    const missao = OG.dados.missoesPorId[missaoId];
    if (!missao) throw new Error('Missão desconhecida: ' + missaoId);
    const R = OG.regras;
    const s = (Number(semente) >>> 0) || 1;
    const apertado = !!(opcoes && opcoes.caixaApertado);
    const caixaInicial = apertado ? R.CAIXA_APERTADO : R.CAIXA_INICIAL;

    const estado = {
      versao: R.VERSAO_ESTADO,
      semente: s,
      rng: s,
      caixaApertado: apertado,
      missaoId: missaoId,
      rodada: 1,
      fase: 'evento',
      cartas: missao.projetos.map(function (projetoId, i) {
        return {
          id: projetoId,
          projetoId: projetoId,
          coluna: 'backlog',
          ordem: i,
          progresso: 0,
          equipe: [],
          equipeFinal: [],
          custoPago: null,
          custoItens: [],
          recompensado: false,
          iniciadoNaRodada: null,
          concluidoNaRodada: null,
          revisor: null,
        };
      }),
      proximaOrdem: missao.projetos.length,
      baralho: [],
      eventoAtual: null,
      cartasMovidasNaRodada: [],
      revisoresDaRodada: [],
      doentes: [],
      temporarios: [],
      descontosPendentes: [],
      mutirao: null,
      missaoCumprida: false,
      pendente: null,
      resumo: null,
      livro: [
        { rodada: 1, recurso: 'dinheiro', valor: caixaInicial, tipo: 'inicial', descricao: 'Caixa inicial do Grêmio' },
        { rodada: 1, recurso: 'prestigio', valor: R.PRESTIGIO_INICIAL, tipo: 'inicial', descricao: 'Prestígio inicial' },
        { rodada: 1, recurso: 'tradicao', valor: R.TRADICAO_INICIAL, tipo: 'inicial', descricao: 'Tradição inicial' },
      ],
      historico: [
        { rodada: 1, tipo: 'sistema', texto: 'Partida iniciada: ' + missao.nome + '. Objetivo: concluir ' + missao.objetivo + ' projetos.' },
      ],
    };

    estado.baralho = OG.eventos.montarBaralho(estado);
    OG.eventos.revelarEvento(estado);
    return estado;
  }

  function executar(estado, acao) {
    switch (acao.tipo) {
      case 'CONFIRMAR_EVENTO': return OG.eventos.confirmarEvento(estado, acao.escolha);
      case 'PLANEJAR': return OG.kanban.planejar(estado, acao.cartaId);
      case 'DESPLANEJAR': return OG.kanban.desplanejar(estado, acao.cartaId);
      case 'INICIAR': return OG.kanban.iniciar(estado, acao.cartaId, acao.equipe);
      case 'REVISAR': return OG.kanban.revisar(estado, acao.cartaId, acao.revisorId);
      case 'COMPLETAR_EQUIPE': return OG.kanban.completarEquipe(estado, acao.cartaId, acao.pessoaId);
      case 'USAR_MUTIRAO': return OG.kanban.usarMutirao(estado, acao.cartaId);
      case 'ENCERRAR_RODADA': return OG.rodada.encerrarRodada(estado);
      case 'RESOLVER_DECISAO': return OG.rodada.resolverDecisao(estado, acao.escolha);
      case 'CANCELAR_ENCERRAMENTO': return OG.rodada.cancelarEncerramento(estado);
      case 'AVANCAR': return OG.rodada.avancar(estado);
      default: throw new OG.estado.ErroDeRegra('Ação desconhecida: ' + acao.tipo);
    }
  }

  function aplicar(estado, acao) {
    if (!acao || typeof acao.tipo !== 'string') {
      return { ok: false, erro: 'Ação inválida.', estado: estado };
    }
    // Proteção contra cliques "atrasados" (ex.: botão de uma rodada que já passou).
    if (acao.rodada !== undefined && acao.rodada !== estado.rodada) {
      return { ok: false, erro: 'Essa ação era da rodada ' + acao.rodada + '. O quadro já está na rodada ' + estado.rodada + '.', estado: estado };
    }
    const novo = OG.util.clonar(estado);
    try {
      executar(novo, acao);
      return { ok: true, estado: novo };
    } catch (erro) {
      if (erro instanceof OG.estado.ErroDeRegra) return { ok: false, erro: erro.message, estado: estado };
      throw erro;
    }
  }

  OG.motor = {
    criarPartida,
    aplicar,
  };
})(globalThis);
